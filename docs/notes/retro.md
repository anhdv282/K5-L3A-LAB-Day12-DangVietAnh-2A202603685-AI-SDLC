# Retro (4 phase)

## Evaluation từng phase
| Phase | Đạt | Chưa đạt / rủi ro |
|---|---|---|
| 1 | Đêm 1 chơi tới cuối, headless tất định, 15 test | Định dạng headless tự suy luận (không có văn bản Test Contract v1.0) |
| 2 | Số chuẩn, 3 bản đồ, tick 12 bước, Lướt/Bục/Gió Lạc/Bùa/Gió, FPS ~60 | Hồi quy Phase 1 phát hiện muộn (tự sửa); bot không thắng Đêm 2–3 |
| 3 | Dầu đèn, drain, thắng bình minh, ADR + CHANGELOG, 12 test sửa có lý do, reviewer độc lập | Wander "đi về đèn tắt" có thể lệch test ẩn Phase 1; bot yếu |
| 4 | Bench 555 FPS / p1 291 / load 0.6 s, soak 0 crash, bảng xếp hạng trên đĩa, a11y, e2e 19/19, Release | Soak đạt nhờ cờ V8 (mặc định 2.04); bench đo trên máy tác giả, máy chấm có thể khác; video do người dùng quay |

## Hiệu quả / không hiệu quả khi làm với AI
- **Hiệu quả:** viết test trước rồi cho AI làm xanh; tách `core` khỏi `web` ngay từ đầu giúp headless, bench, soak dùng chung logic; script sinh bằng chứng; để agent khác review.
- **Không hiệu quả:** để AI tự suy luận định dạng contract thiếu văn bản (rủi ro lệch); bot tối ưu bằng thử sai tốn lượt; chụp ảnh headless không có GPU (FPS vô nghĩa) cho tới khi dùng Chrome GPU thật.

## Những lần AI sai và cách phát hiện
Xem bảng trong [ai_log.md](ai_log.md): bot nhả input, hồi quy headless Phase 1, nhạc có bản quyền, `lose_reason`, e2e chờ cố định, soak RSS.

## Nếu làm lại
1. Xin văn bản Test Contract ngay từ đầu thay vì suy luận.
2. Giữ fixture scenario của mọi phase từ Phase 1 và chạy hồi quy mỗi commit.
3. Dựng bench/FPS bằng Chrome GPU thật ngay Phase 1 để tránh số đo giả.
4. Dùng reviewer độc lập từ Phase 2, không chỉ Phase 3.
5. Viết kịch bản e2e trình duyệt sớm hơn, vì giao diện là chỗ ít được test tự động nhất.
