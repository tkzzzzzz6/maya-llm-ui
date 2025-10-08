"""
Qwen-Omni 视频服务 API - 简化版
用于测试和调试，不依赖 Qwen-Omni API
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import base64
import logging
import cv2
import numpy as np

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

OUTPUT_DIR = "./qwen_output"
os.makedirs(OUTPUT_DIR, exist_ok=True)


def process_video_frame(frame_data):
    """
    处理视频帧数据
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
        logger.info(f"原始帧尺寸: {width}x{height}")

        if height > 720:
            scale = 720.0 / height
            new_width = int(width * scale)
            new_height = 720
            frame = cv2.resize(frame, (new_width, new_height))
            logger.info(f"调整后尺寸: {new_width}x{new_height}")

        # 编码为 JPEG
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 70]
        success, encoded_img = cv2.imencode('.jpg', frame, encode_param)

        if not success:
            logger.error("JPEG 编码失败")
            return None

        # 检查大小
        img_size = len(encoded_img.tobytes())
        logger.info(f"JPEG 大小: {img_size} bytes")

        if img_size > 500 * 1024:  # 500KB
            logger.info("图像超过 500KB，降低质量重新编码")
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 50]
            success, encoded_img = cv2.imencode('.jpg', frame, encode_param)
            if not success:
                return None
            img_size = len(encoded_img.tobytes())
            logger.info(f"重新编码后大小: {img_size} bytes")

        # Base64 编码
        img_b64 = base64.b64encode(encoded_img.tobytes()).decode('ascii')
        logger.info(f"Base64 长度: {len(img_b64)}")

        return img_b64

    except Exception as e:
        logger.error(f"视频帧处理错误: {e}", exc_info=True)
        return None


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        "status": "ok",
        "service": "Qwen-Omni Video Service (Simple)",
        "mode": "test"
    })


@app.route('/api/analyze-video', methods=['POST'])
def analyze_video():
    """
    简化版视频分析 - 仅测试视频处理，返回模拟结果
    """
    try:
        logger.info("=" * 60)
        logger.info("收到视频分析请求")
        logger.info(f"Content-Type: {request.content_type}")
        logger.info(f"Is JSON: {request.is_json}")
        logger.info(f"Form keys: {list(request.form.keys())}")
        logger.info(f"Files keys: {list(request.files.keys())}")

        # 获取参数
        if request.is_json:
            data = request.get_json()
            frame_b64 = data.get('frame')
            question = data.get('question', '请描述这个视频中的内容')
            logger.info("使用 JSON 格式")
        else:
            frame_b64 = None
            question = request.form.get('question', '请描述这个视频中的内容')
            logger.info(f"使用 FormData 格式")
            logger.info(f"问题: {question}")

            if 'video' in request.files:
                video_file = request.files['video']
                logger.info(f"收到视频文件: {video_file.filename}")
                logger.info(f"文件大小: {video_file.content_length if video_file.content_length else 'unknown'}")

                frame_data = video_file.read()
                logger.info(f"读取视频数据: {len(frame_data)} bytes")

                frame_b64 = process_video_frame(frame_data)

                if frame_b64:
                    logger.info(f"✅ 视频处理成功")
                else:
                    logger.error("❌ 视频处理失败")

        if not frame_b64:
            logger.error("没有提供视频帧或处理失败")
            return jsonify({
                "error": "没有提供视频帧或视频处理失败"
            }), 400

        # 模拟分析结果（实际使用时需要调用 Qwen-Omni API）
        logger.info("✅ 返回模拟分析结果")

        result = {
            "analysis": f"[模拟结果] 这是一个测试视频。问题: {question}",
            "transcript": "",
            "frame_processed": True,
            "frame_size": len(frame_b64)
        }

        logger.info(f"分析结果: {result}")
        logger.info("=" * 60)

        return jsonify(result)

    except Exception as e:
        logger.error(f"视频分析错误: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    logger.info("=" * 60)
    logger.info("Qwen-Omni 视频服务启动中（简化测试版）...")
    logger.info("=" * 60)
    logger.info("")
    logger.info("✅ 服务启动成功！")
    logger.info("📍 地址: http://0.0.0.0:5002")
    logger.info("⚠️  测试模式：不连接 Qwen-Omni API")
    logger.info("📹 功能：视频帧处理测试")
    logger.info("")
    logger.info("📚 API 端点:")
    logger.info("   GET  /health - 健康检查")
    logger.info("   POST /api/analyze-video - 视频分析（返回模拟结果）")
    logger.info("")
    logger.info("=" * 60)

    app.run(host='0.0.0.0', port=5002, debug=False, threaded=True)
