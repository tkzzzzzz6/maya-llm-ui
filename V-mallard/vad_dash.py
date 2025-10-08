# dashscope SDK 版本需不低于 1.23.9
import os
import base64
import signal
import sys
import time
import pyaudio
import contextlib
import threading
import queue
import cv2
import numpy as np
from dashscope.audio.qwen_omni import *
import dashscope
# 如果没有设置环境变量，请用您的 API Key 将下行替换为dashscope.api_key = "sk-xxx"
dashscope.api_key = os.getenv('DASHSCOPE_API_KEY') or "sk-c5c3e296dfc74fb9bef2fa4481b7cd78"
voice = 'Cherry'
conversation = None
video_cap = None

# ========== 性能配置 ==========
FRAME_INTERVAL_MS = 500  # 发送帧率: 2fps (500ms间隔)
VIDEO_RESOLUTION = '480p'  # 固定使用480p，流畅优先
DISPLAY_FPS = 120  # 显示帧率: 可调整 (30/60/120)
# =============================

class B64PCMPlayer:
    def __init__(self, pya: pyaudio.PyAudio, sample_rate=24000, chunk_size_ms=100):
        self.pya = pya
        self.sample_rate = sample_rate
        self.chunk_size_bytes = chunk_size_ms * sample_rate *2 // 1000
        self.player_stream = pya.open(format=pyaudio.paInt16,
                                      channels=1,
                                      rate=sample_rate,
                                      output=True)

        self.raw_audio_buffer: queue.Queue = queue.Queue()
        self.b64_audio_buffer: queue.Queue = queue.Queue()
        self.status_lock = threading.Lock()
        self.status = 'playing'
        self.decoder_thread = threading.Thread(target=self.decoder_loop)
        self.player_thread = threading.Thread(target=self.player_loop)
        self.decoder_thread.start()
        self.player_thread.start()
        self.complete_event: threading.Event = None

    def decoder_loop(self):
        while self.status != 'stop':
          recv_audio_b64 = None
          with contextlib.suppress(queue.Empty):
            recv_audio_b64 = self.b64_audio_buffer.get(timeout=0.1)
          if recv_audio_b64 is None:
            continue
          recv_audio_raw = base64.b64decode(recv_audio_b64)
          # 将原始音频数据推入队列，按块处理
          for i in range(0, len(recv_audio_raw), self.chunk_size_bytes):
            chunk = recv_audio_raw[i:i + self.chunk_size_bytes]
            self.raw_audio_buffer.put(chunk)

    def player_loop(self):
        while self.status != 'stop':
          recv_audio_raw = None
          with contextlib.suppress(queue.Empty):
            recv_audio_raw = self.raw_audio_buffer.get(timeout=0.1)
          if recv_audio_raw is None:
            if self.complete_event:
              self.complete_event.set()
            continue
            # 将块写入pyaudio音频播放器，等待播放完这个块
          self.player_stream.write(recv_audio_raw)

    def cancel_playing(self):
        self.b64_audio_buffer.queue.clear()
        self.raw_audio_buffer.queue.clear()

    def add_data(self, data):
        self.b64_audio_buffer.put(data)

    def wait_for_complete(self):
        self.complete_event = threading.Event()
        self.complete_event.wait()
        self.complete_event = None

    def shutdown(self):
        self.status = 'stop'
        self.decoder_thread.join()
        self.player_thread.join()
        self.player_stream.close()


def init_video_capture(source=0):
    """
    初始化视频捕获 - 固定480p分辨率
    source: 0为默认摄像头，也可以是视频文件路径
    """
    global video_cap
    try:
        video_cap = cv2.VideoCapture(source)
        if video_cap.isOpened():
            # 固定使用480p (640x480) - 流畅优先
            video_cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            video_cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            # 设置缓冲区大小为1，减少延迟
            video_cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            print(f' 视频捕获已初始化: {source} @ 480p (640x480)')
            return True
        else:
            print(f' 无法打开视频源: {source}')
            return False
    except Exception as e:
        print(f' 视频捕获初始化错误: {e}')
        return False

def display_video_frame(frame):
    """
    显示视频帧（高帧率显示，无状态文字叠加）
    """
    if frame is None:
        return
    
    # 直接显示原始帧，不添加任何文字
    cv2.imshow('Qwen-Omni Video Input', frame)

def capture_and_encode_frame():
    """
    捕获视频帧并编码为Base64（用于发送到AI）
    根据文档要求：JPEG格式，最大500KB，Base64编码
    """
    global video_cap
    if not video_cap or not video_cap.isOpened():
        return None
    
    ret, frame = video_cap.read()
    if not ret:
        return None
    
    # 调整分辨率确保在合理范围内（最大1080P，建议720P）
    height, width = frame.shape[:2]
    if height > 720:
        scale = 720.0 / height
        new_width = int(width * scale)
        new_height = 720
        frame = cv2.resize(frame, (new_width, new_height))
    
    # 编码为JPEG
    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 70]  # 调整质量控制大小
    success, encoded_img = cv2.imencode('.jpg', frame, encode_param)
    
    if not success:
        return None
    
    # 检查大小是否超过500KB
    img_size = len(encoded_img.tobytes())
    if img_size > 500 * 1024:  # 500KB
        # 降低质量重新编码
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 50]
        success, encoded_img = cv2.imencode('.jpg', frame, encode_param)
        if not success:
            return None
    
    # Base64编码
    img_b64 = base64.b64encode(encoded_img.tobytes()).decode('ascii')
    return (img_b64, frame)  # 返回编码数据和原始帧

def cleanup_video():
    """清理视频资源"""
    global video_cap
    if video_cap:
        video_cap.release()
        video_cap = None
    cv2.destroyAllWindows()


class MyCallback(OmniRealtimeCallback):
    def on_open(self) -> None:
        global pya
        global mic_stream
        global b64_player
        print(' 连接已建立，正在初始化麦克风和摄像头...')
        
        # 初始化音频
        pya = pyaudio.PyAudio()
        mic_stream = pya.open(format=pyaudio.paInt16,
                            channels=1,
                            rate=16000,
                            input=True)
        b64_player = B64PCMPlayer(pya)
        print(' 麦克风已初始化')
        
        # 直接初始化视频捕获（默认摄像头，480p）
        source = input(" 请输入视频源 (0=默认摄像头，文件路径=视频文件，直接回车=0): ").strip()
        if not source:
            source = 0
        else:
            try:
                source = int(source)
            except ValueError:
                pass  # 保持为字符串路径
        
        init_video_capture(source)
    def on_close(self, close_status_code, close_msg) -> None:
        print('connection closed with code: {}, msg: {}, destroy microphone and video'.format(close_status_code, close_msg))
        cleanup_video()
        sys.exit(0)

    def on_event(self, response: str) -> None:
        try:
            global conversation
            global b64_player
            type = response['type']
            if 'session.created' == type:
                print('start session: {}'.format(response['session']['id']))
            if 'conversation.item.input_audio_transcription.completed' == type:
                print('question: {}'.format(response['transcript']))
            if 'response.audio_transcript.delta' == type:
                text = response['delta']
                print("got llm response delta: {}".format(text))
            if 'response.audio.delta' == type:
                recv_audio_b64 = response['delta']
                b64_player.add_data(recv_audio_b64)
            if 'input_audio_buffer.speech_started' == type:
                print('======VAD Speech Start======')
                b64_player.cancel_playing()
            if 'response.done' == type:
                print('======RESPONSE DONE======')
                print('[Metric] response: {}, first text delay: {}, first audio delay: {}'.format(
                                conversation.get_last_response_id(),
                                conversation.get_last_first_text_delay(),
                                conversation.get_last_first_audio_delay(),
                                ))
        except Exception as e:
            print('[Error] {}'.format(e))
            return

if __name__  == '__main__':
    print('Initializing ...')
    callback = MyCallback()
    conversation = OmniRealtimeConversation(
        model='qwen3-omni-flash-realtime',
        callback=callback,
        )
    conversation.connect()
    conversation.update_session(
        output_modalities=[MultiModality.AUDIO, MultiModality.TEXT],
        voice=voice,
        input_audio_format=AudioFormat.PCM_16000HZ_MONO_16BIT,
        output_audio_format=AudioFormat.PCM_24000HZ_MONO_16BIT,
        enable_input_audio_transcription=True,
        input_audio_transcription_model='gummy-realtime-v1',
        enable_turn_detection=True,
        turn_detection_type='server_vad',
        instructions="你是一个麻鸭领域的专业专家V-mallard。你对麻鸭的生物特征、生活习性、繁殖规律、饲养管理、疾病防治、营养需求、品种分类等方面都有深入的专业知识。你能够为养殖户、研究人员和爱好者提供准确、实用的麻鸭相关咨询和建议。请用专业而友好的语调回答问题，并尽可能提供详细和有价值的信息。" # 设定模型的角色
    )
    def signal_handler(sig, frame):
        print('Ctrl+C pressed, stop recognition ...')
        conversation.close()
        b64_player.shutdown()
        cleanup_video()
        print('omni realtime stopped.')
        sys.exit(0)
    signal.signal(signal.SIGINT, signal_handler)
    print("\n" + "="*60)
    print(" V-mallard终端-实时视频对话系统已启动")
    print("="*60)
    print(" 视频输入已启用 (480p) - Video input enabled")
    print("   - 实时画面将显示在独立窗口中（无状态叠加）")
    print(f"   - 显示帧率: {DISPLAY_FPS}fps | 发送帧率: 2fps")
    print("  现在可以开始说话，AI 会实时响应...")
    print("  退出方式: Ctrl+C 或在视频窗口按 'q' 键")
    print("="*60 + "\n")
    
    last_photo_time = time.time()*1000
    last_display_time = time.time()
    frame_count = 0
    display_interval = 1.0 / DISPLAY_FPS  # 每帧间隔时间 (基于配置的FPS)
    
    while True:
        if mic_stream and video_cap:
            # 先发送音频数据（使用更小的缓冲区以提高循环频率）
            # 800字节 = 25ms音频数据 (16000Hz * 2bytes * 0.025s)
            audio_data = mic_stream.read(800, exception_on_overflow=False)
            audio_b64 = base64.b64encode(audio_data).decode('ascii')
            conversation.append_audio(audio_b64)
            
            #  按照60fps频率读取并显示视频帧
            current_display_time = time.time()
            if current_display_time - last_display_time >= display_interval:
                ret, frame = video_cap.read()
                if ret:
                    display_video_frame(frame)
                    frame_count += 1
                last_display_time = current_display_time
            
            #  按照固定间隔（2fps）发送视频帧到AI
            current_time = time.time() * 1000
            if current_time - last_photo_time >= FRAME_INTERVAL_MS:
                result = capture_and_encode_frame()
                if result:
                    try:
                        frame_b64, _ = result
                        # 使用append_video方法发送视频帧
                        conversation.append_video(frame_b64)
                        last_photo_time = current_time
                        print("#", end="", flush=True)  # 显示视频帧发送进度
                    except Exception as e:
                        print(f"\nError sending video frame: {e}")
            
            #  处理键盘事件（必须每次循环都执行，保持窗口流畅）
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                print("\n按下 'q' 键，正在退出...")
                conversation.close()
                b64_player.shutdown()
                cleanup_video()
                sys.exit(0)
        else:
            break