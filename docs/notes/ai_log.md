# Nhật ký dùng AI và chi phí

Công cụ: Claude Code (Claude Opus 5.5 cho phần lớn việc; Sonnet 5.5 ở cuối Phase 4) + 1 subagent review ở Phase 3. Không có số đo token chính xác từ nhà cung cấp; các số dưới đây là **ước tính** theo kích thước tài liệu đã đọc và mã đã sinh. Chi phí tiền **chưa tính** vì không có bảng giá/đơn vị gốc đáng tin trong phiên làm việc.

| Phase | Ước tính token | Việc chính | Cách tiết kiệm | Lỗi AI và cách phát hiện |
|---|---|---|---|---|
| 1 | ~150k | Core sim + headless + three.js + 15 test | Đọc 5 tài liệu lab một lượt; không dùng subagent; chỉ xem 3 ảnh | Test sai kỳ vọng (quên tắt sinh Bóng Mực theo thời gian) → test đỏ |
| 2 | ~300k | Viết lại sim theo 12 bước/tick, 3 bản đồ, Lướt, Gió Lạc, Bùa, UI | Kế hoạch + giả định duyệt trước khi code; chỉ xem 4 ảnh | Bot nhả toàn bộ input mỗi tick lẻ nên đi ~1 m/s: phát hiện bằng trace vị trí/vận tốc theo tick. **Làm hỏng headless Phase 1** (bỏ `steps`, đổi tên sự kiện, xóa scenario): phát hiện khi tự rà mục "lỗi thường gặp". Dùng nhạc có bản quyền: người dùng cấp, bị gỡ khi rà luật |
| 3 | ~280k | Dầu đèn, drain, thắng lúc bình minh, điểm mới, mù màu, nhạc gốc | Test viết trước (27 đỏ), reviewer độc lập chỉ đọc diff | Reviewer bắt `lose_reason` = `dawn_survived` làm lệch Phase 1; `deposited` âm; khóa thừa trong bảng điểm. Tôi tự gây lỗi `//` nuốt 2 trường JSON → test hồi quy bắt ngay |
| 4 | ~350k | Bench, soak, bảng xếp hạng, a11y, e2e, tài liệu, Release | Hỏi 4 câu quyết định một lần; viết test trước; không lặp bench quá 2 lần | Soak RSS tỉ lệ 2.04: không "chỉnh số" mà đo theo thành phần (heap phẳng) rồi báo người dùng quyết định dùng cờ V8. Kịch bản e2e chờ cố định thay vì chờ điều kiện → 2 FAIL giả; sửa kịch bản chứ không nới tiêu chí |
| **Tổng** | **~1.1M** | | | |

## Harness tạo hiệu quả lớn nhất
1. **Test tự động thay lời dặn:** `contract sync`, `architecture` (cấm three/DOM/đồng hồ trong `src/core`), `phase1-regression` (scenario chép từ tag cũ).
2. **Hook Stop** chặn kết thúc khi `npm test` đỏ.
3. **Reviewer độc lập** ở Phase 3 bắt 3 lỗi mà tác giả không thấy.
4. AGENTS.md ngắn (43 dòng), chỉ thêm dòng khi lỗi lặp lại.

## Tiết kiệm token
Kế hoạch và giả định được duyệt trước khi code; `Read` theo đoạn; chỉ xem vài ảnh quan trọng; sinh bằng chứng bằng script thay vì mô tả; không để agent chạy vòng lặp sửa lỗi (mỗi lần test đỏ, đọc kỳ vọng của test trước).
