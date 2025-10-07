"""
YAYA 简化版本地语音服务 API
仅使用 Edge-TTS (不需要复杂的模型加载)
提供 Speech-to-Text 和 Text-to-Speech 功能
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import tempfile
import asyncio
import edge_tts
import logging
import speech_recognition as sr
from pydub import AudioSegment
import aiohttp

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允许跨域请求

OUTPUT_DIR = "./yaya_output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return jsonify({
        "status": "ok",
        "service": "YAYA Voice Service (Simple)",
        "features": ["edge-tts", "google-speech-recognition"]
    })

@app.route('/api/speech-to-text', methods=['POST'])
def speech_to_text():
    """语音转文字 API (使用 Google Speech Recognition)"""
    temp_webm_path = None
    temp_wav_path = None

    try:
        # 检查是否有音频文件
        if 'audio' not in request.files:
            return jsonify({"error": "没有提供音频文件"}), 400

        audio_file = request.files['audio']

        # 保存原始音频文件 (可能是 WebM 或其他格式)
        temp_webm_path = os.path.join(OUTPUT_DIR, f"temp_{os.getpid()}.webm")
        audio_file.save(temp_webm_path)

        # 转换为 WAV 格式
        temp_wav_path = os.path.join(OUTPUT_DIR, f"temp_{os.getpid()}.wav")

        logger.info(f"正在转换音频格式: {temp_webm_path} -> {temp_wav_path}")

        try:
            # 使用 pydub 转换音频格式
            audio = AudioSegment.from_file(temp_webm_path)
            audio = audio.set_channels(1)  # 转为单声道
            audio = audio.set_frame_rate(16000)  # 设置采样率为 16kHz
            audio.export(temp_wav_path, format="wav")

            logger.info(f"音频转换完成")
        except Exception as e:
            logger.error(f"音频格式转换失败: {e}")
            return jsonify({"error": f"音频格式转换失败: {e}。请确保已安装 ffmpeg"}), 500

        # 使用 SpeechRecognition 库进行语音识别
        recognizer = sr.Recognizer()

        with sr.AudioFile(temp_wav_path) as source:
            audio_data = recognizer.record(source)

        # 尝试使用 Google Speech Recognition
        try:
            text = recognizer.recognize_google(audio_data, language='zh-CN')
            logger.info(f"识别结果: {text}")
        except sr.UnknownValueError:
            text = ""
            logger.warning("无法识别语音内容")
        except sr.RequestError as e:
            logger.error(f"语音识别服务错误: {e}")
            return jsonify({"error": f"语音识别服务错误: {e}"}), 500

        return jsonify({
            "text": text,
            "service": "YAYA (Google STT)"
        })

    except Exception as e:
        logger.error(f"语音识别错误: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

    finally:
        # 清理临时文件
        for path in [temp_webm_path, temp_wav_path]:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except:
                    pass

@app.route('/api/text-to-speech', methods=['POST'])
def text_to_speech():
    """文字转语音 API"""
    try:
        data = request.get_json()
        text = data.get('text', '')
        voice = data.get('voice', 'zh-CN-XiaoxiaoNeural')  # 默认使用中文女声
        rate = data.get('rate', '+0%')  # 语速
        pitch = data.get('pitch', '+0Hz')  # 音调

        if not text:
            return jsonify({"error": "没有提供文本"}), 400

        # 生成临时文件路径
        temp_audio_path = os.path.join(OUTPUT_DIR, f"tts_{os.getpid()}.mp3")

        # 使用 Edge-TTS 生成语音 (带重试和代理支持)
        async def generate_speech_with_retry():
            max_retries = 3
            # 从环境变量获取代理配置
            proxy = os.environ.get('https_proxy') or os.environ.get('http_proxy')

            for attempt in range(max_retries):
                try:
                    logger.info(f"TTS 生成尝试 {attempt + 1}/{max_retries}")
                    if proxy:
                        logger.info(f"使用代理: {proxy}")

                    # 创建自定义的 connector 以支持代理
                    connector = None
                    if proxy:
                        connector = aiohttp.TCPConnector()

                    communicate = edge_tts.Communicate(
                        text,
                        voice,
                        rate=rate,
                        pitch=pitch,
                        proxy=proxy  # 设置代理
                    )
                    await communicate.save(temp_audio_path)
                    logger.info(f"TTS 生成成功")
                    return True
                except Exception as e:
                    logger.warning(f"TTS 尝试 {attempt + 1} 失败: {e}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(2)  # 等待2秒后重试
                    else:
                        raise

        # 运行异步函数
        try:
            asyncio.run(generate_speech_with_retry())
        except Exception as e:
            error_msg = str(e)
            if "403" in error_msg or "Invalid response status" in error_msg:
                logger.error("Edge-TTS 服务被拒绝，可能是网络限制")
                return jsonify({
                    "error": "Edge-TTS 服务暂时不可用",
                    "details": "可能是网络限制或服务器拒绝。建议检查网络连接或稍后重试。",
                    "suggestion": "您可以尝试使用 OpenAI 或 Google 的 TTS 服务"
                }), 503
            raise

        logger.info(f"TTS 生成完成: {temp_audio_path}")

        # 检查文件是否生成
        if not os.path.exists(temp_audio_path) or os.path.getsize(temp_audio_path) == 0:
            return jsonify({"error": "TTS 生成失败，音频文件为空"}), 500

        # 返回音频文件
        return send_file(
            temp_audio_path,
            mimetype='audio/mpeg',
            as_attachment=False,
            download_name='speech.mp3'
        )

    except Exception as e:
        logger.error(f"TTS 错误: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/voices', methods=['GET'])
def get_voices():
    """获取可用的语音列表"""
    voices = [
        {"id": "zh-CN-XiaoxiaoNeural", "name": "晓晓 (女声)", "language": "zh-CN"},
        {"id": "zh-CN-YunxiNeural", "name": "云希 (男声)", "language": "zh-CN"},
        {"id": "zh-CN-YunyangNeural", "name": "云扬 (男声)", "language": "zh-CN"},
        {"id": "zh-CN-XiaoyiNeural", "name": "晓伊 (女声)", "language": "zh-CN"},
        {"id": "en-US-AriaNeural", "name": "Aria (Female)", "language": "en-US"},
        {"id": "en-US-GuyNeural", "name": "Guy (Male)", "language": "en-US"},
    ]
    return jsonify({"voices": voices})

if __name__ == '__main__':
    logger.info("YAYA 语音服务 (简化版) 启动在 http://localhost:5001")
    logger.info("请确保已安装 ffmpeg 用于音频格式转换")
    app.run(host='0.0.0.0', port=5001, debug=False)
