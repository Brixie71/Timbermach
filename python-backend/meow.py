import cv2
import numpy as np

video_source = 0
cap = cv2.VideoCapture(video_source)

if not cap.isOpened():
    raise ValueError(f"Cannot open video source: {video_source}")

while True:
    ret, frame = cap.read()
    if not ret:
        print("End of video or cannot read frame.")
        break

    orig = frame.copy()

    try:
        # Fixed: COLOR_BGR2GRAY (not COLORBGR2GRAY)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (9, 5), 0)

        edges = cv2.Canny(blur, 50, 150)

        # Fixed: Correct unpacking for OpenCV 4.x
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if len(contours) == 0:
            raise ValueError("No contours detected.")

        largest_contour = max(contours, key=cv2.contourArea)

        if cv2.contourArea(largest_contour) < 100:
            raise ValueError("Largest contour too small to be a square.")

        hull = cv2.convexHull(largest_contour)

        peri = cv2.arcLength(hull, True)
        approx = cv2.approxPolyDP(hull, 0.02 * peri, True)

        if len(approx) != 4:
            rect = cv2.minAreaRect(hull)
            box = cv2.boxPoints(rect)
            corners = np.int0(box)
        else:
            corners = approx.reshape(4, 2)

        for i, (x, y) in enumerate(corners):
            cv2.circle(orig, (x, y), 8, (0, 0, 255), -1)
            cv2.putText(orig, f"P{i+1}", (x + 5, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)

        cv2.drawContours(orig, [corners], -1, (0, 255, 0), 2)

    except Exception as e:
        cv2.putText(orig, f"Error: {str(e)}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

    cv2.imshow("Square Corner Detection", orig)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()