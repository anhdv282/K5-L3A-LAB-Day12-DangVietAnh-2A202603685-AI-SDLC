# Phase 2 (Ticket-02): spec, giả định, test bị thay

> Yêu cầu gốc: [phase2.md](phase2.md). Số liệu/bản đồ/thứ tự tick lấy **nguyên văn** từ ticket, không tự sửa.

## 1. Giả định (chỗ ticket chưa nói rõ), đã được duyệt
| # | Giả định |
|---|---|
| A0 | **Test Contract = `game.contract.json`** (người dùng xác nhận). Mọi khóa `tuning` đều điều khiển logic (có test `contract sync`). Lệnh `headless_cmd` = `node src/headless.js`; tham số và JSON vào/ra do mình định nghĩa theo các trường Ticket-02 nêu (`--night`, snapshot, scenario, input, events), mô tả ở đầu `src/headless.js`. |
| A1 | `spawning` kéo dài 60 tick: đứng yên, không gây hit, rồi `wander`. |
| A2 | `wander`: 2 m/s, hướng ngẫu nhiên (RNG có seed), đổi hướng mỗi 120 tick hoặc khi bị chặn. |
| A3 | Điều kiện "cách người chơi ≥ 15 m" và "không sinh trong vùng an toàn" áp dụng cho cả 3 Đêm. |
| A4 | Lịch sinh Bóng Mực: 2 con ở tick 300, sau đó mỗi 480 / 420 / 360 tick (Đêm 1/2/3). |
| A5 | "Điểm sương ngẫu nhiên" của Gió Lạc = một điểm sinh Bóng Mực của Đêm đó (chọn bằng RNG). Gió Lạc bay (Y = mặt đất + 1 m), không bị địa hình chặn. Chỉ cướp khi đang idle/chase và Mây mang > 0. Tỏa Sáng trúng Gió Lạc `idle` thì không có tác dụng. |
| A6 | Gió mạnh: cơn đầu ở tick 1800, báo trước 120 tick (`wind_warning`), hướng nguyên độ do RNG có seed. Chỉ đẩy Mây. |
| A7 | Vật cản khi đẩy lùi/di chuyển Bóng Mực: vách cao hơn 0.35 m, tháp chuông, mép đảo (không đi ra biển mây). |
| A8 | Tổng điểm game = tổng điểm các Đêm đã thắng. HUD hiện điểm Đêm hiện tại và tổng. |
| A9 | Xuất phát Đêm 2 tại (0,0,0); **Đêm 3 tại (0,0,−30)** vì (0,0,0) nằm trong tháp chuông. Cả hai quay mặt +Z. |
| A10 | Khoảng cách nạp đèn tính 3D từ chân Mây tới chân đèn (để đèn tầng 2 Đêm 3 hoạt động đúng). |
| A11 | Nút bấm (jump/interact/pulse/dash/pause) đều kích hoạt khi chuyển false → true. |
| A12 | `invuln` trong snapshot là boolean, kèm `invuln_s` (số giây). Thời gian trong snapshot tính bằng giây (`*_s`). |

## 2. Acceptance criteria — Phần 3
| Tính năng | Tiêu chí (làm A thì thấy B) | Test |
|---|---|---|
| Lướt | Bấm Shift → 14 m/s trong 12 tick (đi 2.8 m), hồi 90 tick tính từ lúc bắt đầu; đứng yên thì lướt theo hướng mặt; trên không giữ độ cao; không bất tử | `phase2.test.js` dash ×2 |
| Bục nhảy | Đứng lên bục Đêm 2 → bay ~84 tick, đáp đảo kia; phím di chuyển không đổi hướng bay. Bục Đêm 3 → đáp tầng 2 | launch pad ×2 |
| Rơi khỏi đảo | Y < −10 → −1 lửa, mất hết đom đóm, chờ 60 tick, hồi sinh ở điểm xuất phát với bất tử 90 tick; hết lửa thì thua ngay | fall |
| Địa hình Đêm 3 | Vách chặn đi lên, dốc 30°/150° leo được, tháp chuông đặc | night 3 terrain |
| Gió Lạc | Mang ≥ 5 đom đóm và cách ≤ 15 m → chase; chạm → cướp min(3, mang), flee 240 tick → removed; không mất lửa | drifter |
| Gió Lạc + Tỏa Sáng | chase → flee không cướp; flee đang mang → `drifter_drop`, rơi lại đom đóm, biến mất sau 120 tick | drifter + pulse |
| Bùa Gió | Nhặt → `charm_picked` 600 tick, chạy 7.2 m/s, lướt không hồi chiêu (bấm khi đang lướt bị bỏ qua), xuất hiện lại sau 2700 tick | charm |
| Gió mạnh | Báo trước 2 s, mỗi 30 s thổi 5 s, đẩy 2 m/s; `wind_enabled=false` thì tắt | wind |
| Tạm dừng | Esc/P → tick tăng, sim_tick/thời gian/hồi chiêu đứng yên, snapshot `paused`; có menu Tiếp tục/Chơi lại/Cài đặt/Về menu | pause (logic), ảnh/thao tác tay (menu) |
| Trạng thái Bóng Mực | Chỉ dùng spawning/wander/chase/recoil/stunned | shade states |
| Vùng an toàn | Bóng ở trong lúc đèn vừa thắp bị đẩy ra mép 6 m trong ≤ 30 tick, không gây hit | safe zone |
| Thắng/thua | Thắp đèn cuối đúng tick hết giờ → thắng | win/lose order |
| Chuỗi 3 Đêm | Menu → giới thiệu (Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 → Bình Minh + tổng điểm; thua → chơi lại Đêm | night chain (dữ liệu) + kiểm tay UI |
| Cài đặt | Âm lượng, độ nhạy chuột lưu `localStorage` | kiểm tay |
| HUD / màu / âm thanh | Bố cục và bảng màu theo ticket; ánh sáng môi trường 0.15 + 0.55 × tiến độ | ảnh `docs/proof/phase2/img` |
| Hiệu năng | Headless 21.600 tick ≤ 30 s; game ≥ 30 FPS trung bình ở 1280×720 | perf test + `perf.txt`; `scripts/fps.mjs` → `fps.txt` |

## 3. Test Phase 1 bị luật mới thay (đã sửa, không tắt)
| Test cũ | Lý do đổi |
|---|---|
| movement 6 m/s tức thì | Ticket: tăng tốc/dừng ≤ 0.1 s → test kiểm 6 tick |
| pickup ≤ 1.2 m | Ticket: ≤ 1.0 m XZ + chênh cao ≤ 1.5 m |
| lantern cost 5, interact 2.5 m | Ticket: 10 đom đóm, 2.0 m, chọn đèn gần nhất / id nhỏ |
| pulse 2/6 m/2 s, push 4 m tức thì | Ticket: 3/5 m/3 s, đẩy 4 m trong 15 tick, choáng 120 tick |
| shade touch: drop 50 % gần chỗ cũ, invuln 1.5 s | Ticket: rơi ra vành 1.5–2.5 m, TTL 480 tick, bất tử 90 tick |
| safe zone đẩy tức thì | Ticket: bóng đang ở trong bị đẩy ra trong ≤ 30 tick, không gây hit |
| lose reason `flames`/`time` | Ticket: `no_flames`/`dawn` |
| score: +10 khi nhặt, +25/stun | Ticket: +10 mỗi đom đóm **nạp**, +5 mỗi lần trúng Tỏa Sáng |
| "nhảy cao né được Bóng Mực" | Ticket: chạm khi XZ ≤ 1.0 m và chênh cao ≤ 1.5 m (không còn luật riêng) |
| bot thắng 8/8 seed Đêm 1 | Số chuẩn khó hơn; bot chỉ là công cụ demo. Test giữ "bot thắng Đêm 1 seed 1" |

## 4. Đánh giá Phase 2
- **Đạt (có test/bằng chứng):** số chuẩn, 3 bản đồ, thứ tự 12 bước mỗi tick, lướt, bục nhảy, rơi + hồi sinh, Tỏa Sáng chuẩn, 5 trạng thái Bóng Mực, vùng an toàn 30 tick, Gió Lạc, Bùa Gió, gió mạnh, pause, thứ tự thắng/thua, tất định, hiệu năng headless (~0.2 s / 21.600 tick).
- **FPS:** ~60 FPS trung bình cả 3 Đêm ở 1280×720, GPU thật Apple M4 (`docs/proof/phase2/fps.txt`).
- **Đồng bộ contract:** 3 khóa trước đó chưa được đọc (`invuln_s`, `fall_enabled`, `lantern_count_night1`) nay đã điều khiển logic; thêm 3 test `contract sync`.
- **Có code nhưng chưa có bằng chứng đầy đủ:** luồng menu/giới thiệu/Bình Minh, menu tạm dừng, cài đặt lưu localStorage, âm thanh, đồng hồ đỏ ≤ 30 s.
- **Rủi ro còn lại:** test ẩn có thể gọi headless với tham số/tên trường khác định dạng mình đặt (A0). Bot chưa thắng Đêm 2–3 nên chưa có bằng chứng tự động rằng 2 Đêm này thắng được.
- **Có hỏng Phase 1 không:** luật Phase 1 bị **thay theo ticket** (bảng mục 3). Các hành vi lõi Phase 1 (đi, nhảy, nhặt, nạp, thắp, Bóng Mực đuổi, tỏa sáng, thắng/thua/điểm, chơi lại) vẫn có test trong `tests/sim.test.js`.

## 5. Nhật ký dùng AI (Phase 2)
| Bước | Ghi chú |
|---|---|
| Lập kế hoạch | Agent đề xuất kế hoạch + 8 giả định; **người dùng duyệt trước khi code** (yêu cầu: không tự sửa luật của khách). |
| Viết `maps.js`, `sim.js`, `headless.js` | Viết lại theo tick. Agent tự phát hiện lỗi: tick lướt cuối chạy 6 m/s thay vì 14 (sửa trước khi viết test). |
| Bot | Lỗi lớn: bot nhả **toàn bộ** input mỗi tick lẻ nên tốc độ chỉ ~1 m/s. Phát hiện bằng trace vị trí/vận tốc theo tick. Sau sửa: Đêm 1 thắng 4/6 seed. |
| Test | 28 test. 3 test đỏ lần đầu đều do **kỳ vọng của test sai** (khoảng cách nhặt, chạm sau vài tick, off-by-one tick). Đã ghi bài học vào AGENTS.md. |
| Renderer | Một lần ghi file thất bại vì file đổi trên đĩa; ảnh chụp lúc đó dùng code cũ nên đã bỏ và chụp lại. |

**Token ước tính Phase 2:** khoảng 250–300k (đọc ticket ~10k, sinh code sim/headless/test ~110k, renderer ~70k, debug bot + ảnh ~60k, tài liệu ~30k). Tiết kiệm: không dùng subagent, chỉ xem 4 ảnh, dừng tối ưu bot khi đã đủ cho mục đích demo.

## 6. So sánh giả định Phase 1 ↔ Ticket-02
| Giả định Phase 1 (docs/notes/phase1.md) | Ticket-02 nói gì | Trạng thái |
|---|---|---|
| Test Contract chưa có văn bản → tự định dạng headless | Contract là `game.contract.json` (người dùng xác nhận) + thay đổi v1.1 | **Làm rõ** → A0 |
| Đảo bán kính 30 m, đèn trên vòng 18 m | Bán kính 40 m, 5 đèn tọa độ cố định | **Đổi** |
| Xuất phát ở tâm | (0,0,0), quay +Z | **Xác nhận** (thêm hướng mặt) |
| `flames` = máu, 3 | Ngọn Lửa 3, hồi đầy mỗi Đêm | **Xác nhận** |
| `fall_enabled=false`, bị chặn ở mép | Rơi khi Y < −10, hồi sinh sau 60 tick | **Đổi** (contract `fall_enabled: true`) |
| Đèn nạp từng phần | Nạp nhiều lần, đèn nhớ tiến độ | **Xác nhận** (chi phí 5 → 10) |
| Hết giờ thì thua | Thua `dawn`; thắp đèn cuối đúng tick hết giờ vẫn thắng | **Xác nhận + làm rõ** |
| 30 đom đóm, mỗi 2 s sinh 1 | 20 lúc đầu trên điểm cố định, mỗi 240 tick, trần 30 | **Đổi** |
| Đốm rơi rải 2–4 m, không hết hạn | Vành 1.5–2.5 m, tồn tại 480 tick | **Đổi** |
| Bóng Mực: 2 con đầu, +1 mỗi 30 s, tối đa 6 | 2 con ở tick 300, +1 mỗi 480 tick, tối đa 6; có trạng thái | **Đổi** |
| Nhảy cao > 1 m né được Bóng Mực | Chạm khi chênh cao ≤ 1.5 m | **Đổi** |
| Thưởng thời gian/lửa chỉ khi thắng | Giống vậy | **Xác nhận** |
| `per_stun` tính mỗi con trúng mỗi lần | +5 mỗi con mỗi lần, kể cả đang choáng | **Xác nhận** (25 → 5) |
| Điểm đom đóm khi nhặt | +10 mỗi đom đóm **nạp** | **Đổi** |
| Không dùng Doraemon/Nobita, nhạc tự sáng tác | Bản quyền: chỉ CC0/CC-BY/MIT/tự tạo | **Xác nhận**; đã bỏ chỗ nạp mp3 có bản quyền |

## 7. Kiểm chứng trước khi code
- Kế hoạch kiểm chứng (mục 4 của kế hoạch) được viết và duyệt **trước** khi code Phase 2. Tuy vậy, với phần lõi đầu tiên, test được viết **sau** `sim.js` (ghi trung thực).
- Đợt sửa hồi quy/tách tầng/chuỗi Đêm làm đúng thứ tự: viết `tests/phase1-regression.test.js`, `tests/architecture.test.js`, `tests/campaign.test.js` → chạy **9 đỏ** ([tdd-red.txt](../proof/phase2/tdd-red.txt)) → code → **42/42 xanh**.

## 8. Lỗi hồi quy đã bắt được
- Code Phase 2 đã **làm hỏng headless Phase 1**: định dạng `steps` bị bỏ qua mà không báo, các trường đầu ra Phase 1 mất, tên sự kiện `pickup`/`deposit` bị đổi, 3 scenario Phase 1 bị xóa.
- Sửa: 3 scenario Phase 1 lấy nguyên văn từ tag `phase-1` vào `tests/fixtures/phase1/`; headless nhận lại `steps`, `--max-seconds`, `--events`; đầu ra là tập cha (trường v1.1 + trường Phase 1); giữ tên sự kiện Phase 1 nơi ticket không đổi tên.
- Thay đổi có chủ đích theo ticket (không phải hồi quy): `lose_reason` đổi thành `no_flames`/`dawn`; sự kiện `hit` thành `player_hit` (ticket gọi tên `player_hit`).
