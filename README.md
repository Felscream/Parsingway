# Parsingway - FFLogs report previewer for Discord

Parsingway is a small bot that generates a summary of the most played encounters from an FFLogs report.

It's a useful tool for your FFXIV static if you have a dedicated log channel to track your progress through a raid tier, and to preview the content of your reports.

[Invite link](https://discord.com/oauth2/authorize?client_id=1225561517244547112)

<img src="https://i.imgur.com/52eRX0o.png">

For each encounter, Parsingway will indicate :

- the amount of time spent in combat
- the amount of pulls
- the amount of wipe
- the best pull (boss remaining HP) or the best kill (lowest kill time)
- links to the best pull on FFLogs and XIVAnalysis

Dungeons and small encounters are not displayed

### Live logging

Parsingway supports live logging by checking every minute if a report has been updated on FFLogs. If changes are detected, the previous summary is deleted, and a new one is rewritten.

Reports are tracked automatically if they have been updated in the last 8 hours.

Limits :
- Only one report per server can be tracked
- Sending a new message on the channel with the currently tracked report, or a new report on the discord server will interrupt the previous report tracking.
- Tracking stops if no updates have been detected for more than 1 hour and 30 minutes
- Due to API limitations, only 80 reports can be live tracked at once. This limit may increase later.

