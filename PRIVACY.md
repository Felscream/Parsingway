# Privacy Policy

**Effective Date:** May 26, 2026

This Privacy Policy explains how **Parsingway** ("the Bot") collects, uses, and safeguards information when you add the Bot to your Discord server or interact with it.

We take your privacy seriously. The Bot is designed to track and display Final Fantasy XIV raid encounter data from FF Logs, and we process only the minimum amount of data necessary to perform its core functions.

---

## 1. Information We Collect

### A. Discord Data
The Bot interacts with the Discord API. We access the following information:
*   **Guild (Server) and Channel IDs:** Used to route updates and manage the auto-refreshing of encounter logs.
*   **Message Content:** The Bot reads messages in channels where it has access to detect public FF Logs URLs (e.g., `https://www.fflogs.com/reports/...`).
*   **Message IDs:** Used to update and edit existing embed messages with the latest raid data.

### B. FF Logs Data
When a user submits an FF Logs report URL, the Bot queries the public FF Logs API to retrieve:
*   Encounter summaries (boss names, kill/wipe status).
*   Fight metrics (pull durations, player job composition, encounter rankings, and performance percentages).
*   The publicly listed owner/uploader of the report.

### C. Technical Logs
The Bot's backend API tracks general performance metrics including request count, success/failure rate, cooldown throttling, and average API fetch latency.

---

## 2. How We Use the Information

We use the collected information solely for the following purposes:
*   To fetch and format FF Logs reports into Discord embed messages.
*   To automatically update/refresh active raid reports in real-time.
*   To generate backend diagnostic statistics for server maintenance and administration.
*   To enforce command cooldowns to prevent API rate-limiting or abuse.

---

## 3. Data Retention and Storage

We do not use a persistent database to store user personal data or tracking records:
*   **Active Reports:** Tracking data and server mappings are kept in temporary application memory. They are automatically deleted after a period of inactivity (typically 1.5 hours of no updates, defined by `report_TTL`).
*   **History Logs:** The Bot keeps a rolling log of the last 500 reports in backend memory. This history is not persistent and is completely cleared upon restarting the Bot or when manually cleared by the administrator.
*   **Technical Logs:** General operational logs are rotated and stored locally on the hosting server, but they do not contain user message history or personal information.

---

## 4. Third-Party Services

The Bot interacts with:
*   **Discord:** Subject to the [Discord Privacy Policy](https://discord.com/privacy).
*   **FF Logs:** Subject to the [FF Logs Privacy Policy](https://www.fflogs.com/help/privacy). We only fetch public logs. The Bot cannot access private reports unless the user has configured authorized access, and we do not store these credentials.

---

## 5. Your Rights and Data Deletion

Since we do not store persistent user profiles or message logs, there is no permanent database record of your personal data. 
*   **Stop Tracking:** You can stop the Bot from tracking a report by deleting the report embed in Discord, or simply waiting for the 1.5-hour TTL to expire.
*   **Clear History:** Server administrators can clear the in-memory history log at any time via backend administrative tools or by restarting the Bot.
*   **Manual Deletion Request:** If you have concerns or wish to request the manual removal of any transient log data, please open an issue or contact us via the project's GitHub repository.

---

## 6. Changes to this Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in the Bot's features or Discord's developer requirements. We recommend reviewing this document periodically.

---

## 7. Contact

If you have questions or concerns about this Privacy Policy or the Bot's data practices, please open an issue or contact us via the project's GitHub repository.
