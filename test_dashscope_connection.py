"""
测试 Dashscope API 连接
用于诊断 Qwen-Omni 连接问题
"""
import os
import sys

print("=" * 60)
print("Dashscope 连接测试")
print("=" * 60)
print()

# 步骤 1: 检查 API Key
print("步骤 1: 检查 API Key")
print("-" * 60)

api_key = os.getenv('DASHSCOPE_API_KEY') or "sk-c5c3e296dfc74fb9bef2fa4481b7cd78"
print(f"API Key: {api_key[:20]}...{api_key[-10:]}")
print(f"Key 长度: {len(api_key)}")
print()

# 步骤 2: 导入 dashscope
print("步骤 2: 导入 dashscope 库")
print("-" * 60)

try:
    import dashscope
    print("✅ dashscope 导入成功")
    print(f"dashscope 版本: {dashscope.__version__ if hasattr(dashscope, '__version__') else '未知'}")
    dashscope.api_key = api_key
    print(f"已设置 API Key")
except ImportError as e:
    print(f"❌ 导入失败: {e}")
    print("请安装: pip install dashscope")
    sys.exit(1)
print()

# 步骤 3: 导入 Qwen-Omni 模块
print("步骤 3: 导入 Qwen-Omni 模块")
print("-" * 60)

try:
    from dashscope.audio.qwen_omni import (
        OmniRealtimeConversation,
        OmniRealtimeCallback,
        MultiModality,
        AudioFormat
    )
    print("✅ Qwen-Omni 模块导入成功")
except ImportError as e:
    print(f"❌ 导入失败: {e}")
    print("请更新 dashscope: pip install --upgrade dashscope")
    sys.exit(1)
print()

# 步骤 4: 测试创建回调
print("步骤 4: 测试创建回调类")
print("-" * 60)

try:
    class TestCallback(OmniRealtimeCallback):
        def on_open(self):
            print("  → 连接已打开")

        def on_close(self, close_status_code, close_msg):
            print(f"  → 连接已关闭: {close_status_code}, {close_msg}")

        def on_event(self, response: str):
            print(f"  → 收到事件: {response.get('type', 'unknown')}")

    callback = TestCallback()
    print("✅ 回调类创建成功")
except Exception as e:
    print(f"❌ 创建失败: {e}")
    sys.exit(1)
print()

# 步骤 5: 测试创建对话实例
print("步骤 5: 测试创建 OmniRealtimeConversation")
print("-" * 60)

try:
    conversation = OmniRealtimeConversation(
        model='qwen3-omni-flash-realtime',
        callback=callback,
    )
    print("✅ 对话实例创建成功")
except Exception as e:
    print(f"❌ 创建失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
print()

# 步骤 6: 测试连接
print("步骤 6: 测试建立连接")
print("-" * 60)
print("正在连接到 Qwen-Omni 服务...")

try:
    conversation.connect()
    print("✅ 连接成功")
except Exception as e:
    print(f"❌ 连接失败: {e}")
    import traceback
    traceback.print_exc()

    # 提供诊断建议
    print()
    print("可能的原因:")
    print("1. API Key 无效或已过期")
    print("2. 网络连接问题（无法访问阿里云服务）")
    print("3. API 配额已用完")
    print("4. 需要配置代理")
    print()
    print("建议:")
    print("- 访问 https://dashscope.console.aliyun.com/ 检查 API Key")
    print("- 检查网络连接")
    print("- 如果在国外，可能需要配置代理")

    conversation.close()
    sys.exit(1)
print()

# 步骤 7: 测试更新会话配置
print("步骤 7: 测试更新会话配置")
print("-" * 60)

try:
    conversation.update_session(
        voice='Cherry',  # 必需参数
        output_modalities=[MultiModality.TEXT],
        input_audio_format=AudioFormat.PCM_16000HZ_MONO_16BIT,
        output_audio_format=AudioFormat.PCM_24000HZ_MONO_16BIT,
        enable_input_audio_transcription=True,
        input_audio_transcription_model='gummy-realtime-v1',
        enable_turn_detection=True,
        turn_detection_type='server_vad',
        instructions="你是一个测试助手"
    )
    print("✅ 会话配置成功")
except Exception as e:
    print(f"❌ 配置失败: {e}")
    import traceback
    traceback.print_exc()
    conversation.close()
    sys.exit(1)
print()

# 清理
print("步骤 8: 清理连接")
print("-" * 60)

try:
    conversation.close()
    print("✅ 连接已关闭")
except Exception as e:
    print(f"警告: 关闭连接时出错: {e}")
print()

# 总结
print("=" * 60)
print("✅ 所有测试通过！Dashscope 连接正常")
print("=" * 60)
print()
print("您可以使用完整版视频服务:")
print("python qwen_video_server.py")
