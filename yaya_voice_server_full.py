"""
YAYA 完整版本地语音服务 API
基于你的 15.1_SenceVoice_kws_CAM++.py 代码
使用 FunASR (SenseVoice) + Edge-TTS + pygame
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import asyncio
import edge_tts
import logging
from funasr import AutoModel
from pydub import AudioSegment

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允许跨域请求

OUTPUT_DIR = "./YAYA_output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 全局变量
sense_voice_model = None

def initialize_models():
    """初始化 SenseVoice 模型"""
    global sense_voice_model
    try:
        logger.info("正在加载 SenseVoice 模型...")
        sense_voice_model = AutoModel(
            model="iic/SenseVoiceSmall",
            device="cuda",  # 使用 CPU，如果有 GPU 改为 "cuda"
            disable_pbar=False,
            disable_log=False
        )
        logger.info("SenseVoice 模型加载完成")
        return True
    except Exception as e:
        logger.error(f"模型加载失败: {e}")
        logger.warning("将使用在线 Google STT 作为备用方案")
        return False

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return jsonify({
        "status": "ok",
        "service": "YAYA Voice Service (Full)",
        "features": {
            "stt": "SenseVoice" if sense_voice_model else "Google STT (Fallback)",
            "tts": "Edge-TTS"
        },
        "models_loaded": sense_voice_model is not None
    })

@app.route('/api/speech-to-text', methods=['POST'])
def speech_to_text():
    """语音转文字 API"""
    temp_webm_path = None
    temp_wav_path = None

    try:
        if 'audio' not in request.files:
            return jsonify({"error": "没有提供音频文件"}), 400

        audio_file = request.files['audio']

        # 保存原始音频文件
        temp_webm_path = os.path.join(OUTPUT_DIR, f"temp_{os.getpid()}.webm")
        audio_file.save(temp_webm_path)

        # 转换为 WAV 格式
        temp_wav_path = os.path.join(OUTPUT_DIR, f"temp_{os.getpid()}.wav")
        logger.info(f"正在转换音频格式...")

        try:
            audio = AudioSegment.from_file(temp_webm_path)
            audio = audio.set_channels(1)  # 单声道
            audio = audio.set_frame_rate(16000)  # 16kHz
            audio.export(temp_wav_path, format="wav")
            logger.info(f"音频转换完成")
        except Exception as e:
            logger.error(f"音频格式转换失败: {e}")
            return jsonify({"error": f"音频格式转换失败: {e}"}), 500

        # 使用 SenseVoice 进行语音识别
        if sense_voice_model:
            try:
                logger.info(f"使用 SenseVoice 识别...")
                result = sense_voice_model.generate(
                    input=temp_wav_path,
                    cache={},
                    language="auto",  # 自动检测语言
                    use_itn=True,
                    batch_size_s=60,
                    merge_vad=True,
                    merge_length_s=15,
                )

                text = ""
                if result and len(result) > 0:
                    text = result[0]["text"]

                logger.info(f"SenseVoice 识别结果: {text}")

                return jsonify({
                    "text": text,
                    "service": "YAYA (SenseVoice)"
                })

            except Exception as e:
                logger.error(f"SenseVoice 识别错误: {e}")
                return jsonify({"error": f"语音识别失败: {e}"}), 500
        else:
            # 备用方案：使用 Google STT
            import speech_recognition as sr

            recognizer = sr.Recognizer()
            with sr.AudioFile(temp_wav_path) as source:
                audio_data = recognizer.record(source)

            try:
                text = recognizer.recognize_google(audio_data, language='zh-CN')
                logger.info(f"Google STT 识别结果: {text}")
            except sr.UnknownValueError:
                text = ""
                logger.warning("无法识别语音内容")
            except sr.RequestError as e:
                return jsonify({"error": f"语音识别服务错误: {e}"}), 500

            return jsonify({
                "text": text,
                "service": "YAYA (Google STT Fallback)"
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
    """文字转语音 API - 参考你的 amain 函数实现"""
    try:
        data = request.get_json()
        text = data.get('text', '')
        voice = data.get('voice', 'zh-CN-XiaoyiNeural')  # 默认使用晓伊
        rate = data.get('rate', '+0%')
        pitch = data.get('pitch', '+0Hz')

        if not text:
            return jsonify({"error": "没有提供文本"}), 400

        # 生成临时文件路径
        temp_audio_path = os.path.join(OUTPUT_DIR, f"tts_{os.getpid()}.mp3")

        # 使用 Edge-TTS 生成语音 (参考你的代码)
        async def amain(TEXT, VOICE, OUTPUT_FILE):
            """Main function - 参考你的实现"""
            max_retries = 3
            proxy = os.environ.get('https_proxy') or os.environ.get('http_proxy')

            for attempt in range(max_retries):
                try:
                    logger.info(f"TTS 生成尝试 {attempt + 1}/{max_retries}")
                    if proxy:
                        logger.info(f"使用代理: {proxy}")

                    communicate = edge_tts.Communicate(TEXT, VOICE, rate=rate, pitch=pitch, proxy=proxy)
                    await communicate.save(OUTPUT_FILE)
                    logger.info(f"TTS 生成成功")
                    return True
                except Exception as e:
                    logger.warning(f"TTS 尝试 {attempt + 1} 失败: {e}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(2)
                    else:
                        raise

        # 运行异步函数
        try:
            asyncio.run(amain(text, voice, temp_audio_path))
        except Exception as e:
            error_msg = str(e)
            if "403" in error_msg or "Invalid response status" in error_msg:
                logger.error("Edge-TTS 服务被拒绝")
                return jsonify({
                    "error": "Edge-TTS 服务暂时不可用",
                    "details": "请检查网络连接或配置代理",
                    "suggestion": "确保环境变量中设置了 https_proxy"
                }), 503
            raise

        # 检查文件是否生成
        if not os.path.exists(temp_audio_path) or os.path.getsize(temp_audio_path) == 0:
            return jsonify({"error": "TTS 生成失败，音频文件为空"}), 500

        logger.info(f"TTS 生成完成: {temp_audio_path}")

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
    # 参考你代码中的 language_speaker 配置
    voices = [
        {"id": "zh-CN-XiaoxiaoNeural", "name": "晓晓 (女声)", "language": "zh-CN"},
        {"id": "zh-CN-XiaoyiNeural", "name": "晓伊 (女声)", "language": "zh-CN"},
        {"id": "zh-CN-YunxiNeural", "name": "云希 (男声)", "language": "zh-CN"},
        {"id": "zh-CN-YunyangNeural", "name": "云扬 (男声)", "language": "zh-CN"},
        {"id": "zh-TW-HsiaoChenNeural", "name": "曉臻 (台湾女声)", "language": "zh-TW"},
        {"id": "zh-HK-HiuGaaiNeural", "name": "曉佳 (香港女声)", "language": "zh-HK"},
        {"id": "en-US-JennyNeural", "name": "Jenny (Female)", "language": "en-US"},
        {"id": "en-US-GuyNeural", "name": "Guy (Male)", "language": "en-US"},
        {"id": "ja-JP-NanamiNeural", "name": "ななみ (日语女声)", "language": "ja-JP"},
        {"id": "ko-KR-SunHiNeural", "name": "선히 (韩语女声)", "language": "ko-KR"},
    ]
    return jsonify({"voices": voices})

if __name__ == '__main__':
    logger.info("=" * 60)
    logger.info("YAYA 语音服务 (完整版) 启动中...")
    logger.info("=" * 60)

    # 初始化模型
    model_loaded = initialize_models()

    if not model_loaded:
        logger.warning("⚠️  SenseVoice 模型加载失败，将使用 Google STT 备用方案")
        logger.warning("⚠️  如需完整功能，请安装: pip install rotary_embedding_torch")

    logger.info("")
    logger.info("✅ 服务启动成功！")
    logger.info("📍 地址: http://localhost:5001")
    logger.info("🎤 STT: " + ("SenseVoice (本地)" if model_loaded else "Google STT (在线)"))
    logger.info("🔊 TTS: Edge-TTS")
    logger.info("")
    logger.info("💡 提示: 如果 Edge-TTS 无法使用，请设置代理:")
    logger.info("   set https_proxy=http://your-proxy:port")
    logger.info("=" * 60)

    app.run(host='0.0.0.0', port=5001, debug=False)
