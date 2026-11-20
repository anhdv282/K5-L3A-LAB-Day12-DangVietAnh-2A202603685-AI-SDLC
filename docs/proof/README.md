# Bằng chứng — Phase 1 (PRD-0)

Sinh tự động bằng `./scripts/proof.sh` (không sửa tay). Ảnh chụp bằng Chrome headless theo skill `.claude/skills/verify`.

| # | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| 1 | Đêm 1, Đảo Bến tròn, 5 Đèn Lồng | test `contract…5 lanterns`; ảnh | [test-report](phase1/test-report.txt), [start.png](img/start.png) | Đạt |
| 2 | Đi lại, nhảy, camera 3D | test `movement…`, `jump…`; scenario `walk_jump_pulse` (event `jump`); ảnh góc nhìn thứ ba | [walk_jump_pulse.json](phase1/walk_jump_pulse.json), [play.png](img/play.png) | Đạt |
| 3 | Đom đóm rải rác, nhặt được | test `pickup…capped by carry_capacity`; event `pickup` | [walk_jump_pulse.json](phase1/walk_jump_pulse.json) | Đạt |
| 4 | Nạp ánh sáng thắp đèn | test `interact feeds light…`, `out of range` | [walk_jump_pulse.json](phase1/walk_jump_pulse.json) (`lantern_charge:[1,…]`) | Đạt |
| 5 | Bóng Mực xuất hiện, đuổi theo | test `shade touch…`; scenario đứng yên thì thua sau 11 s | [idle_lose.json](phase1/idle_lose.json) | Đạt |
| 6 | Tỏa sáng xua Bóng Mực, tốn ánh sáng | test `pulse costs light…`, `pulse with not enough light fails` | test-report, [lit3.png](img/lit3.png) (Bóng Mực tím nhạt = choáng) | Đạt |
| 7 | Bóng Mực sợ đèn | test `shades cannot enter safe_radius` | test-report | Đạt |
| 8 | Thắng / thua / điểm | test `win…score formula`, `lose when flames…time` | [win_bot.json](phase1/win_bot.json), [win.png](img/win.png) | Đạt |
| 9 | HUD | ảnh: đèn x/5, ánh sáng x/10, 🔥, thời gian, cooldown, điểm | [play.png](img/play.png), [lit3.png](img/lit3.png) | Đạt |
| 10 | Chơi lại sau thắng/thua | nút "Chơi lại" + phím R gọi `newGame()` | [win.png](img/win.png) | Đạt (kiểm tay, chưa có test tự động) |
| 11 | Đảo sáng dần khi thắp đèn | so sánh ảnh 0/5 với 4/5 đèn | [play.png](img/play.png) vs [lit3.png](img/lit3.png) | Đạt |
| 12 | Headless + tất định | 2 lần chạy cùng scenario giống hệt từng byte; test 3 seed | [determinism.txt](phase1/determinism.txt) | Đạt |
| 13 | Chơi được tới cuối | bot thắng ở 8/8 seed | [bot-seeds.txt](phase1/bot-seeds.txt) | Đạt |
| 14 | Định dạng headless đúng Test Contract chính thức | — | — | **Chưa xác nhận**: chưa có văn bản Test Contract v1.0, định dạng đang là giả định (xem notes) |
