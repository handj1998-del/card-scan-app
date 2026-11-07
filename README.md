# 카드 인식 (Card Scan)

카메라로 신용카드 앞면을 읽어 번호/유효기간/이름을 인식하는 정적 웹앱입니다.

- 모든 인식은 **브라우저(사용자 기기) 안에서만** 수행됩니다.
- 카드 번호, 유효기간, 이름, 이미지는 서버/로그/DB/웹훅 어디에도 전송·저장되지 않습니다.
- 저장소/localStorage/쿠키에 PAN을 저장하지 않으며, 새로고침하면 결과가 사라집니다.
- 결제를 처리하지 않는 인식 보조 도구입니다.

## Consent PDF

`consent.html` uses cleaned raster backgrounds of the supplied two-page A4
form. Original example checks are removed; all agreement radios start unset.
The signature editor supports pointer events (finger/stylus/mouse). The PDF is
created entirely in memory, using locally served images and a bundled OFL Korean
font. It contains two flattened A4 pages, including text and signatures; it is
not an editable/searchable PDF. No filled values are uploaded or saved in web
storage. Downloaded files must be protected and deleted separately by the user.
iPad may require Share → Save to Files after opening the generated PDF.

Checks: `node --check consent.js`; the PDF writer and canvas rendering were
exercised with an isolated Node canvas/DOM harness and checked with Poppler
(two A4 pages, Unicode Korean text, dates, ink). Physical tablet/Safari gesture
and download checks remain manual.
