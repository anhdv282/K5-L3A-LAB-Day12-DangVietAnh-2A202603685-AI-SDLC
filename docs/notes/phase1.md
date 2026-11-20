# Phase 1: giả định, kế hoạch, nhật ký AI

## Giả định (chỗ PRD-0 mơ hồ)
- **Test Contract v1.0**: lúc build chưa có văn bản đầy đủ, chỉ có danh sách khóa `tuning` trong `game.contract.json`. Đã tự thiết kế CLI headless: `--scenario <file|->`, `--seed`, `--bot`, `--max-seconds`, `--events`, `--out`; đầu ra là **1 dòng JSON** trên stdout. Khi có contract chính thức thì chỉ sửa `src/headless.js` (adapter), không đụng `sim.js`.
- Đảo bán kính 30 m; 5 đèn đều nhau trên vòng 18 m; Mây xuất phát ở tâm.
- `flames` = máu (3 ngọn lửa). `fall_enabled=false` thì không rơi khỏi đảo (bị chặn ở mép). Nếu bật: rơi thì mất 1 lửa và về tâm.
- Đèn nạp từng phần (E nạp tối đa phần còn thiếu). Tỏa sáng cần mang ≥ `pulse_cost` đốm.
- Hết 300 s chưa thắp đủ đèn thì thua (`lose_reason:"time"`).
- Đom đóm: 30 con cùng lúc, mỗi 2 s sinh lại 1 con nếu thiếu. Đốm bị rơi khi trúng đòn rải thành đom đóm cách 2–4 m.
- Bóng Mực: 2 con lúc đầu, cứ 30 s thêm 1 con (tối đa 6), sinh ở mép đảo, cách Mây ≥ 12 m, không sinh trong vùng an toàn. Đang nhảy cao hơn 1 m thì không bị chạm.
- Thưởng thời gian và thưởng lửa **chỉ cộng khi thắng**. `per_stun` tính theo từng con bị trúng mỗi lần tỏa sáng.
- Nhân vật phụ Doraemon/Nobita và nhạc Doraemon **không dùng** vì vi phạm bản quyền (RULES §8). Thay bằng hình tượng dân gian (Thỏ Ngọc, Chú Cuội) và nhạc tự sáng tác.

## Kế hoạch kiểm chứng (viết trước khi code)
1. Tách `sim.js` thuần, bước cố định, RNG có seed → test đơn vị từng luật với số lấy từ contract.
2. Scenario headless: thắng (bot), thua (đứng yên), thao tác đi/nhảy/tỏa sáng/nạp.
3. Tất định: chạy 2 lần, so từng byte.
4. Ảnh Chrome headless cho phần chỉ nhìn mới thấy (HUD, đảo sáng dần, nhân vật).

## Nhật ký dùng AI
| Bước | Công cụ | Ghi chú |
|---|---|---|
| Đọc RULES/GUIDE/SUBMISSION/RUBRIC, lập kế hoạch | Claude Code (Opus 5.5) | 1 lượt đọc gộp để tiết kiệm token |
| Viết sim.js + headless + 15 test | Claude Code | 1 test sai lần đầu (helper "calm" quên tắt sinh Bóng Mực theo thời gian), sửa test chứ không sửa luật |
| Viết renderer three.js, audio | Claude Code | Bị từ chối vẽ Doraemon/Nobita (bản quyền) → đổi thành nhân vật dân gian |
| Ảnh bằng chứng | Chrome headless | Virtual time không chạy rAF đủ nhanh → thêm `?ff=S` tua bằng bot để chụp trạng thái giữa/cuối game |

**Token ước tính Phase 1:** khoảng 120–150k token (đọc tài liệu ~25k, sinh code ~60k, kiểm chứng + ảnh ~30k). Cách tiết kiệm: không dùng subagent, đọc tài liệu một lần, gộp nhiều lệnh shell, chỉ xem 3 ảnh quan trọng.

## Đánh giá nhanh
- Đạt: 13/14 dòng trong bảng truy vết. Chưa xác nhận: định dạng headless so với contract chính thức.
- Lỗi AI: test sai giả định (đã phát hiện nhờ test đỏ). Harness đã thêm: Stop hook chặn kết thúc khi `npm test` đỏ.
- Cần làm tiếp: dán Test Contract v1.0 thật → chỉnh adapter headless + test CLI.
