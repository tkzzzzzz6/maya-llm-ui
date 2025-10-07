from PIL import Image

# 打开 PNG 图片
img = Image.open("logo.png")

# 保存为 ICO 格式，可以指定多种尺寸
img.save("favicon.ico", format='ICO', sizes=[(16,16), (32,32), (48,48), (64,64), (128,128), (256,256)])
