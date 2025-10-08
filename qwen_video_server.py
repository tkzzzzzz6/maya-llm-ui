"""
Qwen-Omni 视频服务 API
基于 qwen.omini/vad_dash.py 代码
提供 Flask API 接口供前端调用
支持视频 + 音频的实时对话
"""

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import os
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
CORS(app)  # 允许跨域请求

# Dashscope API 配置
dashscope.api_key = os.getenv('DASHSCOPE_API_KEY') or "sk-c5c3e296dfc74fb9bef2fa4481b7cd78"

# 全局配置
OUTPUT_DIR = "./qwen_output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 视频配置
FRAME_INTERVAL_MS = 500  # 发送帧率: 2fps (500ms间隔)
VIDEO_RESOLUTION = '480p'  # 固定使用480p

# 会话管理
sessions = {}  # 存储活动会话
session_lock = threading.Lock()


class VideoAnalysisSession:
    """视频分析会话类"""

    def __init__(self, session_id, instructions="你是一个智能视频分析助手"):
        self.session_id = session_id
        self.instructions = instructions
        self.conversation = None
        self.response_queue = queue.Queue()
        self.is_active = False
        self.last_response = ""
        self.last_transcript = ""

    def start(self):
        """启动会话"""
        try:
            logger.info(f"启动会话: {self.session_id}")
            logger.info(f"Dashscope API Key: {dashscope.api_key[:20]}...")

            # 创建回调处理器
            callback = self._create_callback()

            # 创建对话实例
            logger.info("创建 OmniRealtimeConversation 实例...")
            self.conversation = OmniRealtimeConversation(
                model='qwen3-omni-flash-realtime',
                callback=callback,
            )

            # 建立连接
            logger.info("建立连接...")
            self.conversation.connect()

            # 更新会话配置
            logger.info("更新会话配置...")
            self.conversation.update_session(
                voice='Cherry',  # 必需参数：语音类型
                output_modalities=[MultiModality.TEXT],  # 只返回文本，不返回音频
                input_audio_format=AudioFormat.PCM_16000HZ_MONO_16BIT,
                output_audio_format=AudioFormat.PCM_24000HZ_MONO_16BIT,
                enable_input_audio_transcription=False,  # 禁用音频转录（视频分析不需要）
                enable_turn_detection=False,  # 禁用 VAD，改为手动提交
                instructions=self.instructions
            )

            self.is_active = True
            logger.info(f"会话 {self.session_id} 启动成功")
            return True

        except Exception as e:
            logger.error(f"会话启动失败: {e}", exc_info=True)
            return False

    def _create_callback(self):
        """创建回调处理器"""
        session = self

        class SessionCallback(OmniRealtimeCallback):
            def on_open(self):
                logger.info(f"会话 {session.session_id} 连接已建立")

            def on_close(self, close_status_code, close_msg):
                logger.info(f"会话 {session.session_id} 关闭: {close_status_code}, {close_msg}")
                session.is_active = False

            def on_event(self, response: str):
                try:
                    event_type = response.get('type', '')

                    if event_type == 'session.created':
                        logger.info(f"会话 ID: {response['session']['id']}")

                    elif event_type == 'conversation.item.input_audio_transcription.completed':
                        transcript = response.get('transcript', '')
                        session.last_transcript = transcript
                        logger.info(f"语音转文字: {transcript}")

                    elif event_type == 'response.audio_transcript.delta':
                        delta = response.get('delta', '')
                        session.last_response += delta
                        session.response_queue.put({
                            'type': 'delta',
                            'text': delta
                        })

                    elif event_type == 'response.done':
                        logger.info("响应完成")
                        session.response_queue.put({
                            'type': 'done',
                            'text': session.last_response
                        })
                        session.last_response = ""

                except Exception as e:
                    logger.error(f"事件处理错误: {e}")

        return SessionCallback()

    def send_video_frame(self, frame_b64):
        """发送视频帧"""
        if self.conversation and self.is_active:
            try:
                self.conversation.append_video(frame_b64)
                return True
            except Exception as e:
                logger.error(f"发送视频帧失败: {e}")
                return False
        return False

    def send_audio(self, audio_b64):
        """发送音频数据"""
        if self.conversation and self.is_active:
            try:
                self.conversation.append_audio(audio_b64)
                return True
            except Exception as e:
                logger.error(f"发送音频失败: {e}")
                return False
        return False

    def get_response(self, timeout=1.0):
        """获取响应"""
        try:
            return self.response_queue.get(timeout=timeout)
        except queue.Empty:
            return None

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
    """
    处理视频帧数据
    frame_data: Base64 编码的图像数据、原始图像字节或视频文件
    返回: 调整大小并压缩的 Base64 编码 JPEG
    """
    try:
        # 如果是 Base64 字符串，先解码
        if isinstance(frame_data, str):
            img_bytes = base64.b64decode(frame_data)
        else:
            img_bytes = frame_data

        logger.info(f"处理视频帧，数据大小: {len(img_bytes)} bytes")

        # 先尝试作为图像解码
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # 如果无法作为图像解码，尝试作为视频处理
        if frame is None:
            logger.info("尝试作为视频文件处理...")
            # 保存临时文件
            temp_video_path = os.path.join(OUTPUT_DIR, f"temp_video_{os.getpid()}.webm")
            with open(temp_video_path, 'wb') as f:
                f.write(img_bytes)

            # 使用 OpenCV 读取视频的第一帧
            cap = cv2.VideoCapture(temp_video_path)
            ret, frame = cap.read()
            cap.release()

            # 清理临时文件
            try:
                os.remove(temp_video_path)
            except:
                pass

            if not ret or frame is None:
                logger.error("无法从视频中提取帧")
                return None

            logger.info(f"成功从视频提取帧，尺寸: {frame.shape}")

        if frame is None:
            logger.error("帧为空")
            return None

        # 调整分辨率（最大720p）
        height, width = frame.shape[:2]
        if height > 720:
            scale = 720.0 / height
            new_width = int(width * scale)
            new_height = 720
            frame = cv2.resize(frame, (new_width, new_height))

        # 编码为 JPEG
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 70]
        success, encoded_img = cv2.imencode('.jpg', frame, encode_param)

        if not success:
            return None

        # 检查大小是否超过 500KB
        img_size = len(encoded_img.tobytes())
        if img_size > 500 * 1024:  # 500KB
            # 降低质量重新编码
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 50]
            success, encoded_img = cv2.imencode('.jpg', frame, encode_param)
            if not success:
                return None

        # Base64 编码
        img_b64 = base64.b64encode(encoded_img.tobytes()).decode('ascii')
        return img_b64

    except Exception as e:
        logger.error(f"视频帧处理错误: {e}")
        return None


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return jsonify({
        "status": "ok",
        "service": "Qwen-Omni Video Service",
        "features": {
            "video_analysis": "Qwen3-Omni-Flash-Realtime",
            "audio_input": "Supported",
            "text_output": "Supported"
        },
        "active_sessions": len(sessions)
    })


@app.route('/api/session/create', methods=['POST'])
def create_session():
    """创建新的视频分析会话"""
    try:
        data = request.get_json() or {}
        instructions = data.get('instructions', '你是一个智能视频分析助手，可以理解视频内容并回答相关问题。')

        # 生成会话 ID
        session_id = f"session_{int(time.time() * 1000)}"

        # 创建会话
        session = VideoAnalysisSession(session_id, instructions)

        if session.start():
            with session_lock:
                sessions[session_id] = session

            return jsonify({
                "session_id": session_id,
                "status": "created",
                "message": "会话创建成功"
            })
        else:
            return jsonify({
                "error": "会话创建失败"
            }), 500

    except Exception as e:
        logger.error(f"创建会话错误: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/session/<session_id>/close', methods=['POST'])
def close_session(session_id):
    """关闭会话"""
    try:
        with session_lock:
            session = sessions.get(session_id)
            if session:
                session.close()
                del sessions[session_id]
                return jsonify({
                    "status": "closed",
                    "message": "会话已关闭"
                })
            else:
                return jsonify({
                    "error": "会话不存在"
                }), 404

    except Exception as e:
        logger.error(f"关闭会话错误: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/session/<session_id>/video', methods=['POST'])
def send_video(session_id):
    """发送视频帧到会话"""
    try:
        session = sessions.get(session_id)
        if not session:
            return jsonify({"error": "会话不存在"}), 404

        # 获取视频帧数据
        if 'video' in request.files:
            video_file = request.files['video']
            frame_data = video_file.read()
        elif request.is_json:
            data = request.get_json()
            frame_b64 = data.get('frame')
            if not frame_b64:
                return jsonify({"error": "没有提供视频帧"}), 400
            frame_data = frame_b64
        else:
            return jsonify({"error": "无效的请求格式"}), 400

        # 处理视频帧
        processed_frame = process_video_frame(frame_data)
        if not processed_frame:
            return jsonify({"error": "视频帧处理失败"}), 500

        # 发送到 Qwen-Omni
        if session.send_video_frame(processed_frame):
            return jsonify({
                "status": "sent",
                "message": "视频帧已发送"
            })
        else:
            return jsonify({
                "error": "发送视频帧失败"
            }), 500

    except Exception as e:
        logger.error(f"发送视频错误: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/session/<session_id>/audio', methods=['POST'])
def send_audio(session_id):
    """发送音频到会话"""
    try:
        session = sessions.get(session_id)
        if not session:
            return jsonify({"error": "会话不存在"}), 404

        # 获取音频数据
        if 'audio' in request.files:
            audio_file = request.files['audio']
            audio_data = audio_file.read()
            audio_b64 = base64.b64encode(audio_data).decode('ascii')
        elif request.is_json:
            data = request.get_json()
            audio_b64 = data.get('audio')
            if not audio_b64:
                return jsonify({"error": "没有提供音频"}), 400
        else:
            return jsonify({"error": "无效的请求格式"}), 400

        # 发送到 Qwen-Omni
        if session.send_audio(audio_b64):
            return jsonify({
                "status": "sent",
                "message": "音频已发送"
            })
        else:
            return jsonify({
                "error": "发送音频失败"
            }), 500

    except Exception as e:
        logger.error(f"发送音频错误: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/session/<session_id>/response', methods=['GET'])
def get_response(session_id):
    """获取会话响应（流式）"""
    try:
        session = sessions.get(session_id)
        if not session:
            return jsonify({"error": "会话不存在"}), 404

        def generate():
            """生成流式响应"""
            while session.is_active:
                response = session.get_response(timeout=0.5)
                if response:
                    yield f"data: {jsonify(response).get_data(as_text=True)}\n\n"
                else:
                    # 发送心跳
                    yield f"data: {jsonify({'type': 'ping'}).get_data(as_text=True)}\n\n"

        return Response(generate(), mimetype='text/event-stream')

    except Exception as e:
        logger.error(f"获取响应错误: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analyze-video', methods=['POST'])
def analyze_video():
    """
    一次性视频分析 API（简化版）
    上传视频帧 + 可选音频，返回分析结果
    """
    temp_session_id = None
    try:
        logger.info(f"收到视频分析请求")
        logger.info(f"Content-Type: {request.content_type}")
        logger.info(f"Is JSON: {request.is_json}")
        logger.info(f"Form keys: {list(request.form.keys())}")
        logger.info(f"Files keys: {list(request.files.keys())}")

        # 获取参数
        if request.is_json:
            data = request.get_json()
            frame_b64 = data.get('frame')
            audio_b64 = data.get('audio')
            question = data.get('question', '请描述这个视频中的内容')
            logger.info("使用 JSON 格式")
        else:
            frame_b64 = None
            audio_b64 = None
            question = request.form.get('question', '请描述这个视频中的内容')
            logger.info(f"使用 FormData 格式，question: {question}")

            if 'video' in request.files:
                video_file = request.files['video']
                logger.info(f"收到视频文件: {video_file.filename}, 大小: {video_file.content_length}")
                frame_data = video_file.read()
                logger.info(f"读取视频数据: {len(frame_data)} bytes")
                frame_b64 = process_video_frame(frame_data)
                logger.info(f"处理后的 Base64 长度: {len(frame_b64) if frame_b64 else 0}")

            if 'audio' in request.files:
                audio_file = request.files['audio']
                logger.info(f"收到音频文件: {audio_file.filename}")
                audio_data = audio_file.read()
                audio_b64 = base64.b64encode(audio_data).decode('ascii')

        if not frame_b64:
            logger.error("没有提供视频帧或视频处理失败")
            return jsonify({"error": "没有提供视频帧或视频处理失败"}), 400

        # 创建临时会话
        temp_session_id = f"temp_{int(time.time() * 1000)}"
        session = VideoAnalysisSession(temp_session_id, f"用户问题: {question}")

        if not session.start():
            return jsonify({"error": "会话创建失败"}), 500

        with session_lock:
            sessions[temp_session_id] = session

        # 发送视频帧
        logger.info("发送视频帧到 Qwen-Omni...")
        session.send_video_frame(frame_b64)

        # 如果有音频，发送音频（注意：我们禁用了音频转录）
        if audio_b64:
            logger.info("发送音频数据...")
            session.send_audio(audio_b64)

        # 手动提交输入（触发 AI 响应）
        # 因为我们禁用了 VAD，所以需要手动 commit
        logger.info("手动提交输入，触发 AI 响应...")
        try:
            if hasattr(session.conversation, 'commit_input'):
                session.conversation.commit_input()
            else:
                # 如果没有 commit_input 方法，尝试发送一个空的用户消息来触发响应
                session.conversation.create_response()
        except Exception as e:
            logger.warning(f"提交输入时出错: {e}")

        # 等待响应（最多 30 秒）
        logger.info("等待 AI 响应...")
        timeout = 30
        start_time = time.time()
        full_response = ""

        while time.time() - start_time < timeout:
            response = session.get_response(timeout=1.0)
            if response:
                logger.info(f"收到响应: {response['type']}")
                if response['type'] == 'delta':
                    full_response += response['text']
                elif response['type'] == 'done':
                    full_response = response['text']
                    logger.info(f"响应完成，总长度: {len(full_response)}")
                    break

        if not full_response:
            logger.warning(f"超时未收到响应（等待了 {time.time() - start_time:.1f} 秒）")

        return jsonify({
            "analysis": full_response or "未收到分析结果，请检查视频和问题",
            "transcript": session.last_transcript
        })

    except Exception as e:
        logger.error(f"视频分析错误: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

    finally:
        # 清理临时会话
        if temp_session_id and temp_session_id in sessions:
            with session_lock:
                sessions[temp_session_id].close()
                del sessions[temp_session_id]


if __name__ == '__main__':
    logger.info("=" * 60)
    logger.info("Qwen-Omni 视频服务启动中...")
    logger.info("=" * 60)
    logger.info("")
    logger.info("✅ 服务启动成功！")
    logger.info("📍 地址: http://0.0.0.0:5002")
    logger.info("📹 视频分析: Qwen3-Omni-Flash-Realtime")
    logger.info("🎤 音频输入: PCM 16kHz")
    logger.info("💬 文本输出: 流式响应")
    logger.info("")
    logger.info("📚 API 端点:")
    logger.info("   POST /api/session/create - 创建会话")
    logger.info("   POST /api/session/<id>/video - 发送视频帧")
    logger.info("   POST /api/session/<id>/audio - 发送音频")
    logger.info("   GET  /api/session/<id>/response - 获取响应（流式）")
    logger.info("   POST /api/session/<id>/close - 关闭会话")
    logger.info("   POST /api/analyze-video - 一次性分析")
    logger.info("")
    logger.info("💡 提示: 设置 DASHSCOPE_API_KEY 环境变量使用您的 API Key")
    logger.info("=" * 60)

    app.run(host='0.0.0.0', port=5002, debug=False, threaded=True)
