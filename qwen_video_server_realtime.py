"""
Qwen-Omni 视频服务 API - 实时流式版本
参考 vad_dash.py 的设计，支持实时视频+音频流处理
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sock import Sock
import os
import json
import base64
import logging
import threading
import queue
import time
import cv2
import numpy as np
from dashscope.audio.qwen_omni import *
import dashscope

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)
sock = Sock(app)

# Dashscope API 配置
dashscope.api_key = os.getenv('DASHSCOPE_API_KEY') or "sk-c5c3e296dfc74fb9bef2fa4481b7cd78"

OUTPUT_DIR = "./qwen_output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 性能配置（参考 vad_dash.py）
FRAME_INTERVAL_MS = 500  # 发送帧率: 2fps
VIDEO_RESOLUTION = '480p'

# 会话管理
sessions = {}
session_lock = threading.Lock()


class RealtimeVideoSession:
    """实时视频分析会话 - 参考 vad_dash.py"""

    def __init__(self, session_id, websocket, instructions="你是一个智能视频分析助手"):
        self.session_id = session_id
        self.websocket = websocket
        self.instructions = instructions
        self.conversation = None
        self.is_active = False
        self.last_frame_time = 0
        self.response_queue = queue.Queue()

    def start(self):
        """启动实时会话"""
        try:
            logger.info(f"启动实时会话: {self.session_id}")

            # 创建回调
            callback = self._create_callback()

            # 创建对话实例
            self.conversation = OmniRealtimeConversation(
                model='qwen3-omni-flash-realtime',
                callback=callback,
            )

            # 建立连接
            self.conversation.connect()

            # 更新会话配置（启用 VAD，参考 vad_dash.py）
            self.conversation.update_session(
                voice='Cherry',
                output_modalities=[MultiModality.AUDIO, MultiModality.TEXT],  # 同时返回音频和文本
                input_audio_format=AudioFormat.PCM_16000HZ_MONO_16BIT,
                output_audio_format=AudioFormat.PCM_24000HZ_MONO_16BIT,
                enable_input_audio_transcription=True,  # 启用音频转录
                input_audio_transcription_model='gummy-realtime-v1',
                enable_turn_detection=True,  # 启用 VAD
                turn_detection_type='server_vad',  # 服务端 VAD
                instructions=self.instructions
            )

            self.is_active = True
            logger.info(f"实时会话 {self.session_id} 启动成功")
            return True

        except Exception as e:
            logger.error(f"会话启动失败: {e}", exc_info=True)
            return False

    def _create_callback(self):
        """创建回调处理器 - 参考 vad_dash.py"""
        session = self

        class SessionCallback(OmniRealtimeCallback):
            def on_open(self):
                logger.info(f"会话 {session.session_id} 连接已建立")
                session._send_to_client({
                    'type': 'session.opened',
                    'session_id': session.session_id
                })

            def on_close(self, close_status_code, close_msg):
                logger.info(f"会话 {session.session_id} 关闭: {close_status_code}")
                session.is_active = False

            def on_event(self, response: str):
                try:
                    event_type = response.get('type', '')

                    if event_type == 'session.created':
                        logger.info(f"会话创建: {response['session']['id']}")

                    elif event_type == 'conversation.item.input_audio_transcription.completed':
                        transcript = response.get('transcript', '')
                        logger.info(f"语音转录: {transcript}")
                        session._send_to_client({
                            'type': 'transcript',
                            'text': transcript
                        })

                    elif event_type == 'response.audio_transcript.delta':
                        delta = response.get('delta', '')
                        session._send_to_client({
                            'type': 'text.delta',
                            'text': delta
                        })

                    elif event_type == 'response.audio.delta':
                        audio_b64 = response.get('delta', '')
                        session._send_to_client({
                            'type': 'audio.delta',
                            'audio': audio_b64
                        })

                    elif event_type == 'input_audio_buffer.speech_started':
                        logger.info("检测到语音开始")
                        session._send_to_client({
                            'type': 'speech.started'
                        })

                    elif event_type == 'response.done':
                        logger.info("响应完成")
                        session._send_to_client({
                            'type': 'response.done'
                        })

                except Exception as e:
                    logger.error(f"事件处理错误: {e}")

        return SessionCallback()

    def _send_to_client(self, data):
        """发送数据到客户端"""
        try:
            self.websocket.send(json.dumps(data))
        except Exception as e:
            logger.error(f"发送到客户端失败: {e}")

    def append_video(self, frame_b64):
        """发送视频帧 - 参考 vad_dash.py"""
        if not self.is_active or not self.conversation:
            return False

        try:
            # 控制发送频率（2fps）
            current_time = time.time() * 1000
            if current_time - self.last_frame_time < FRAME_INTERVAL_MS:
                return True  # 跳过，频率太高

            self.conversation.append_video(frame_b64)
            self.last_frame_time = current_time
            return True
        except Exception as e:
            logger.error(f"发送视频帧失败: {e}")
            return False

    def append_audio(self, audio_b64):
        """发送音频数据 - 参考 vad_dash.py"""
        if not self.is_active or not self.conversation:
            return False

        try:
            self.conversation.append_audio(audio_b64)
            return True
        except Exception as e:
            logger.error(f"发送音频失败: {e}")
            return False

    def close(self):
        """关闭会话"""
        if self.conversation:
            try:
                self.conversation.close()
                self.is_active = False
                logger.info(f"会话 {self.session_id} 已关闭")
            except Exception as e:
                logger.error(f"关闭会话失败: {e}")


def process_video_frame(frame_data):
    """处理视频帧 - 参考 vad_dash.py"""
    try:
        if isinstance(frame_data, str):
            img_bytes = base64.b64decode(frame_data)
        else:
            img_bytes = frame_data

        # 尝试作为图像解码
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            # 尝试作为视频文件
            temp_path = os.path.join(OUTPUT_DIR, f"temp_{os.getpid()}.webm")
            with open(temp_path, 'wb') as f:
                f.write(img_bytes)

            cap = cv2.VideoCapture(temp_path)
            ret, frame = cap.read()
            cap.release()
            os.remove(temp_path)

            if not ret:
                return None

        # 调整分辨率到 720p（参考 vad_dash.py）
        height, width = frame.shape[:2]
        if height > 720:
            scale = 720.0 / height
            frame = cv2.resize(frame, (int(width * scale), 720))

        # 编码为 JPEG
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 70]
        success, encoded = cv2.imencode('.jpg', frame, encode_param)

        if not success:
            return None

        # 检查大小（最大 500KB）
        if len(encoded.tobytes()) > 500 * 1024:
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 50]
            success, encoded = cv2.imencode('.jpg', frame, encode_param)

        return base64.b64encode(encoded.tobytes()).decode('ascii')

    except Exception as e:
        logger.error(f"视频帧处理错误: {e}")
        return None


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        "status": "ok",
        "service": "Qwen-Omni Video Service (Realtime)",
        "active_sessions": len(sessions),
        "mode": "realtime_stream"
    })


@sock.route('/ws/video')
def websocket_video(ws):
    """
    WebSocket 实时视频分析
    客户端发送: {type: 'video', data: base64} 或 {type: 'audio', data: base64}
    服务端返回: {type: 'text.delta', text: '...'} 或 {type: 'audio.delta', audio: '...'}
    """
    session_id = f"ws_{int(time.time() * 1000)}"
    logger.info(f"新的 WebSocket 连接: {session_id}")

    try:
        # 创建会话
        session = RealtimeVideoSession(session_id, ws)

        if not session.start():
            ws.send(json.dumps({'type': 'error', 'message': '会话启动失败'}))
            return

        with session_lock:
            sessions[session_id] = session

        # 发送欢迎消息
        ws.send(json.dumps({
            'type': 'ready',
            'session_id': session_id,
            'message': '实时视频分析会话已建立'
        }))

        # 接收客户端消息
        while True:
            message = ws.receive()
            if message is None:
                break

            try:
                data = json.loads(message)
                msg_type = data.get('type')

                if msg_type == 'video':
                    # 接收视频帧
                    frame_b64 = data.get('data')
                    if frame_b64:
                        # 处理视频帧
                        processed = process_video_frame(frame_b64)
                        if processed:
                            session.append_video(processed)

                elif msg_type == 'audio':
                    # 接收音频数据
                    audio_b64 = data.get('data')
                    if audio_b64:
                        session.append_audio(audio_b64)

                elif msg_type == 'close':
                    break

            except Exception as e:
                logger.error(f"处理消息错误: {e}")

    except Exception as e:
        logger.error(f"WebSocket 错误: {e}")

    finally:
        # 清理会话
        if session_id in sessions:
            with session_lock:
                sessions[session_id].close()
                del sessions[session_id]

        logger.info(f"WebSocket 连接关闭: {session_id}")


if __name__ == '__main__':
    logger.info("=" * 60)
    logger.info("Qwen-Omni 视频服务启动中（实时流式版）...")
    logger.info("=" * 60)
    logger.info("")
    logger.info("✅ 服务启动成功！")
    logger.info("📍 地址: http://0.0.0.0:5003")
    logger.info("📹 视频分析: Qwen3-Omni-Flash-Realtime")
    logger.info("🔄 模式: 实时流式处理（WebSocket）")
    logger.info("🎤 VAD: 启用（自动检测语音）")
    logger.info("")
    logger.info("📚 WebSocket 端点:")
    logger.info("   ws://localhost:5003/ws/video - 实时视频流")
    logger.info("")
    logger.info("💡 参考: vad_dash.py 设计")
    logger.info("=" * 60)

    app.run(host='0.0.0.0', port=5003, debug=False, threaded=True)
