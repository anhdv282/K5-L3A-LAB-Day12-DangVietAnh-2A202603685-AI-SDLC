# Bằng chứng — Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2)

Sinh tự động: `./scripts/proof.sh 3` (không sửa tay). FPS: `node scripts/fps.mjs 1 15`. Quyết định thiết kế: [ADR 0001](../../adr/0001-lantern-fuel-and-dawn-win.md). Breaking changes: [CHANGELOG](../../../CHANGELOG.md).

**Viết test trước khi code:** [tdd-red.txt](tdd-red.txt) có 27 test đỏ khác nhau trước khi sửa `sim.js`: 15/17 test Phase 3 viết lúc đó (2 test đã xanh sẵn) + 12 test cũ bị luật mới thay. Ghi trung thực: test hồi quy `idle_lose` chỉ đỏ **sau khi** code (do luật wander mới) nên được sửa sau; 3 test Phase 3 bổ sung theo góp ý reviewer cũng viết sau khi code. Hiện tại 62/62 xanh ([test-report](test-report.txt)).

| # | Yêu cầu | Test / cách kiểm | Bằng chứng | Kết quả |
|---|---|---|---|---|
| 1 | Contract v1.2: 8 khóa mới, thời lượng 240/270/300 | `contract 1.2: new tuning keys`, `contract sync` (mọi khóa được logic đọc) | test-report | Đạt |
| 2 | Dầu 100, hao 1/s, tính bằng đơn vị 1/60 nguyên, xuất 1 chữ số thập phân | `fuel: lit lantern starts at 100 and decays 1/s` | test-report | Đạt |
| 3 | Châm dầu đúng công thức, +5/đom đóm, sự kiện `refuel` | `refuel: used = min(...)` | test-report | Đạt |
| 4 | Đèn đầy không được chọn | `full lantern is not selectable` | test-report | Đạt |
| 5 | Hết dầu → `lantern_out`, `deposited 0`, `ever_lit` | `fuel runs out` | test-report | Đạt |
| 6 | Thắp lại cần 5, +40, `relight: true`, `relit_count` | `first light … relight …` | test-report | Đạt |
| 7 | Sức chứa 10 + 2×thắp, tối đa 20, đèn đặt sẵn không tính | `capacity = 10 + 2 x successful_lights` | test-report, [fuel.png](img/fuel.png) (HUD `1/16`) | Đạt |
| 8 | Vùng an toàn chỉ khi dầu ≥ 30 (đúng 30 vẫn an toàn) | `safe zone only while fuel >= 30` | test-report | Đạt |
| 9 | Wander nhắm đèn yếu → `drain` 5/s cộng dồn, `fuel_drain` mỗi 60 tick | `wander shade targets the weak lantern …`, `walks toward a weak lantern from afar` | test-report | Đạt |
| 10 | Thoát `drain` (chase / wander / đẩy ra khi châm ≥ 30) | `drain exits …` | test-report | Đạt |
| 11 | Tỏa Sáng +15 khi trúng bóng đang drain | `pulse: +15 total …` | test-report | Đạt |
| 12 | Không còn thắng sớm | `no early win` | test-report | Đạt |
| 13 | Thắng `dawn_survived` 3/5, 4/6, 5/7; thua `dawn`; thưởng bình minh | `dawn: win dawn_survived …` | test-report | Đạt |
| 14 | Hết lửa ở tick cuối → `no_flames` trước | `last tick: running out of flames beats dawn_survived` | test-report | Đạt |
| 15 | `game_over.reason`, snapshot/scenario v1.2 | `game_over event …`, `scenario/snapshot v1.2 …` | test-report | Đạt |
| 16 | Thanh dầu, nhấp nháy 1 Hz khi < 30, đèn tắt xẹp + rách | ảnh (Chrome headless) | [fuel.png](img/fuel.png) | Đạt về code; ảnh chụp tĩnh nên không thấy nhấp nháy, vết rách chưa có ảnh cận |
| 17 | Chế độ mù màu (viền/mắt `#00B3FF`, cảnh báo trắng + ⚠, lưu cài đặt) | ảnh `?cb` | [colorblind.png](img/colorblind.png) (đồng hồ trắng + ⚠) | Đạt (viền Bóng Mực chưa có trong khung ảnh) |
| 18 | Test cũ bị thay: sửa kèm lý do, không skip | `grep -n "\[Ticket-03\]" tests/*.js`; bảng trong CHANGELOG | CHANGELOG | Đạt: 12 test sửa, 0 test xóa/skip (reviewer độc lập xác nhận) |
| 19 | Test ẩn Phase 1–2 không bị thay vẫn đạt | `phase1-regression`, `phase2.test.js`, `sim.test.js` | test-report | Đạt với test của mình |
| 20 | Tất định, hiệu năng, FPS | `determinism.txt`, `perf.txt`, `fps.txt` | [determinism](determinism.txt) [perf](perf.txt) [fps](fps.txt) | Đạt: IDENTICAL ×3; ~0.2 s; 60 FPS |
| 21 | Chơi được tới bình minh | bot 6 seed × 3 Đêm | [bot-nights.txt](bot-nights.txt) | Đêm 1: bot thắng 2/6. Đêm 2–3: **bot chưa thắng** (bot đơn giản) |
| 22 | Nhạc nền tự sáng tác | `src/web/audio.js` ("Đêm Đèn Lồng", tổng hợp WebAudio); test `no copyrighted/external audio` | CREDITS | Đạt |

## Review độc lập (subagent khác người viết code)
Reviewer đọc diff + ticket + chạy lại `npm test`. Kết luận: luật lõi (đơn vị dầu, thứ tự bước 2, công thức châm dầu, chọn đèn, thắp lại, vùng an toàn 30, drain, đẩy ra, thắng/thua, điểm, sự kiện) khớp ticket; tách tầng sạch; không có test bị xóa/skip. Phát hiện và xử lý:

| # | Phát hiện | Xử lý |
|---|---|---|
| 1 | `lose_reason` ra `dawn_survived` khi thắng (Phase 1 là `null`) | Sửa `src/headless.js`; khôi phục kiểm `lose_reason === null` trong regression |
| 2 | `idle_lose` bị nới lỏng do wander mới đi về đèn tắt | **Giữ**: người dùng đã duyệt đọc theo chữ ticket ("đi về đèn tắt gần nhất"). Ghi là rủi ro |
| 3 | Scenario đặt `deposited` > chi phí thắp lại làm `put` âm | Sửa `Math.max(0, …)` + test mới |
| 4 | Thêm khóa vào `tuning.score` có thể lệch kiểm tra chính xác của contract | Chuyển 3 giá trị ra hằng `SCORE_RELIGHT/PULSE_DRAIN/LIT_AT_DAWN` trong `sim.js`; bảng `score` giữ đúng bộ khóa cũ |
| 5 | Tốc độ dầu không nguyên bị làm tròn âm thầm | Ném lỗi rõ ràng nếu không phải số nguyên |
| 6 | Thiếu test thoát drain khi > 2 m và test chase không đổi mục tiêu | Thêm 2 test |
| 7 | Số đếm test-first trong README sai | Sửa (đoạn trên) |
