"""
测试 Qwen Video API 的脚本
用于调试视频上传问题
"""
import requests
import cv2
import numpy as np
import base64

# 创建一个测试图像（纯色图像）
def create_test_image():
    # 创建一个 640x480 的蓝色图像
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    img[:, :] = (255, 0, 0)  # BGR 格式的蓝色

    # 添加一些文字
    cv2.putText(img, 'Test Image', (200, 240),
                cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3)

    # 编码为 JPEG
    success, encoded = cv2.imencode('.jpg', img)
    if not success:
        raise Exception("Failed to encode image")

    return encoded.tobytes()

def test_with_image_file():
    """测试 1: 使用图像文件"""
    print("=" * 60)
    print("测试 1: 使用图像文件上传")
    print("=" * 60)

    img_bytes = create_test_image()

    files = {
        'video': ('test.jpg', img_bytes, 'image/jpeg')
    }

    data = {
        'question': '请描述这张图片'
    }

    url = 'http://localhost:5002/api/analyze-video'

    print(f"发送请求到: {url}")
    print(f"图像大小: {len(img_bytes)} bytes")

    try:
        response = requests.post(url, files=files, data=data)
        print(f"响应状态: {response.status_code}")
        print(f"响应内容: {response.text}")

        if response.status_code == 200:
            result = response.json()
            print(f"✅ 成功! 分析结果: {result}")
        else:
            print(f"❌ 失败! 状态码: {response.status_code}")
    except Exception as e:
        print(f"❌ 错误: {e}")

def test_with_base64():
    """测试 2: 使用 Base64 编码"""
    print("\n" + "=" * 60)
    print("测试 2: 使用 Base64 编码上传")
    print("=" * 60)

    img_bytes = create_test_image()
    img_b64 = base64.b64encode(img_bytes).decode('ascii')

    data = {
        'frame': img_b64,
        'question': '请描述这张图片'
    }

    url = 'http://localhost:5002/api/analyze-video'

    print(f"发送请求到: {url}")
    print(f"Base64 长度: {len(img_b64)}")

    try:
        response = requests.post(url, json=data)
        print(f"响应状态: {response.status_code}")
        print(f"响应内容: {response.text}")

        if response.status_code == 200:
            result = response.json()
            print(f"✅ 成功! 分析结果: {result}")
        else:
            print(f"❌ 失败! 状态码: {response.status_code}")
    except Exception as e:
        print(f"❌ 错误: {e}")

def test_health():
    """测试 3: 健康检查"""
    print("\n" + "=" * 60)
    print("测试 3: 健康检查")
    print("=" * 60)

    url = 'http://localhost:5002/health'

    try:
        response = requests.get(url)
        print(f"响应状态: {response.status_code}")
        print(f"响应内容: {response.json()}")

        if response.status_code == 200:
            print("✅ 服务运行正常")
        else:
            print("❌ 服务异常")
    except Exception as e:
        print(f"❌ 无法连接到服务: {e}")
        print("请确保 qwen_video_server.py 正在运行")

if __name__ == '__main__':
    # 先测试健康检查
    test_health()

    # 测试图像文件上传
    test_with_image_file()

    # 测试 Base64 上传
    test_with_base64()

    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)
