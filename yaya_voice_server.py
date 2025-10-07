"""
YAYA 本地语音服务 API
基于 FunASR (SenseVoice) 和 Edge-TTS
提供 Speech-to-Text 和 Text-to-Speech 功能
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import tempfile
import asyncio
from funasr import AutoModel
import edge_tts
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 全局变量
sense_voice_model = None
OUTPUT_DIR = "./yaya_output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def initialize_models():
    """初始化语音识别模型"""
    global sense_voice_model
    try:
        logger.info("正在加载 SenseVoice 模型...")
        # 使用 FunASR 的 SenseVoice 模型
        # 注意：首次运行会自动下载模型，需要等待
        sense_voice_model = AutoModel(
            model="iic/SenseVoiceSmall",
            device="",  # 使用 CPU，如果有 GPU 可以改为 "cuda"
            # vad_model="fsmn-vad",  # 暂时禁用 VAD 以简化配置
            # vad_kwargs={"max_single_segment_time": 30000},
            disable_pbar=False,  # 显示进度条
            disable_log=False    # 显示日志
        )
        logger.info("SenseVoice 模型加载完成")
    except Exception as e:
        logger.error(f"模型加载失败: {e}")
        logger.error("请尝试手动安装依赖: pip install rotary_embedding_torch")
        raise

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return jsonify({
        "status": "ok",
        "service": "YAYA Voice Service",
        "models_loaded": sense_voice_model is not None
    })

@app.route('/api/speech-to-text', methods=['POST'])
def speech_to_text():
    """语音转文字 API"""
    try:
        if sense_voice_model is None:
            return jsonify({"error": "SenseVoice 模型未加载"}), 500

        # 检查是否有音频文件
        if 'audio' not in request.files:
            return jsonify({"error": "没有提供音频文件"}), 400

        audio_file = request.files['audio']

        # 保存临时文件
        temp_audio_path = os.path.join(OUTPUT_DIR, f"temp_{os.getpid()}.wav")
        audio_file.save(temp_audio_path)

        try:
            # 使用 SenseVoice 进行语音识别
            logger.info(f"正在识别音频: {temp_audio_path}")
            result = sense_voice_model.generate(
                input=temp_audio_path,
                cache={},
                language="auto",  # 自动检测语言
                use_itn=True,
                batch_size_s=60,
                merge_vad=True,
                merge_length_s=15,
            )

            # 提取识别结果
            text = ""
            if result and len(result) > 0:
                text = result[0]["text"]

            logger.info(f"识别结果: {text}")

            return jsonify({
                "text": text,
                "service": "YAYA (SenseVoice)"
            })

        finally:
            # 清理临时文件
            if os.path.exists(temp_audio_path):
                os.remove(temp_audio_path)

    except Exception as e:
        logger.error(f"语音识别错误: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

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

        # 使用 Edge-TTS 生成语音
        async def generate_speech():
            communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
            await communicate.save(temp_audio_path)

        # 运行异步函数
        asyncio.run(generate_speech())

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
    logger.info("正在初始化 YAYA 语音服务...")
    initialize_models()
    logger.info("YAYA 语音服务启动在 http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=False)
