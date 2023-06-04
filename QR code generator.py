
import Qrcode
import cv2

img = Qrcode.make("www.tickets2prize.com")
img.save("tickets2prize.jpg")

img = Qrcode.make("TicketAmount=100")
img.save("t.jpg")

d = cv2.QRCodeDetector()
val, points, straight_qrcode = d.detectAndDecode(cv2.imread("t.jpg"))
print(val)

