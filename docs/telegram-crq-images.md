# Telegram CRQ image import

Send a clear, upright daily activity table photo (or JPG/PNG document, under 8 MB) to the linked bot in a private chat. Each horizontal row must contain a date such as `13-Nov-26` or `2026-11-03`, site name, node name, activity details and a `CRQ` followed by 6–20 digits. Exported tables may also include siteId and Site Category between site name and node name, plus Activity Descriptions after Activity Details. Keep all columns visible. Image text is treated as data only.

Repeated image activities with the same site, date, node and activity details contribute distinct CRQs to one existing activity's comma-separated `crqNo`. Existing real CRQs are retained; `CRQ00000` placeholders are removed. The importer creates no sheets or rows, does not delete existing duplicate activities, and preserves all other row and sheet fields. If multiple existing rows match, it skips that image row instead of choosing one. Different dates stay separate. Times are not used to split otherwise identical activities.

Super Users can update their assigned site. Admin and Super Admin users can update sites named in the image. The stored active account, role and Telegram binding are rechecked in the write transaction. Ordinary Users cannot import images. The dashboard already subscribes to the collection and needs no frontend change.

OCR uses Google Cloud Vision's DOCUMENT_TEXT_DETECTION endpoint with the function service account's application default credential. Enable `vision.googleapis.com` in the Firebase project's Google Cloud console and ensure that billing and the runtime service account's API access are configured. No new API key or npm dependency is needed. See [Google's OCR documentation](https://docs.cloud.google.com/vision/docs/ocr).

Deploy the backend after configuring Vision:

```powershell
firebase deploy --only "functions:load-book:telegramWebhook" --project wb-airtelmscs
```

Verify with a linked test account and one known activity before importing a whole table. Local tests mock database operations and OCR coordinates; they do not call Telegram, Vision or production Firestore. OCR mistakes that produce valid-looking identifiers cannot be fully detected; review the saved CRQs against the source image.

```powershell
node --test functions/load-book/telegram-crq.test.cjs functions/load-book/telegram-functions.test.cjs functions/load-book/telegram-reports.test.cjs
```
