# Parsingway - FFLogs report previewer for Discord

Parsingway is a small bot that generates a summary of the most played encounters from an FFLogs report.

It's a useful tool for your FFXIV static if you have a dedicated log channel to track your progress through a raid tier, and want to preview the content of your reports.

[Invite link](https://discord.com/oauth2/authorize?client_id=1225561517244547112)

<img src="https://i.imgur.com/Sn5Vih9.png">

For each encounter, Parsingway will indicate :

- the amount of time spent in combat
- the nubmer of kills
- the number of wipes
- the best pull (boss remaining HP) or the best kill (lowest kill time)
- links to the best pull on FFLogs and XIVAnalysis

Dungeons and small encounters are not displayed

### Live logging

Parsingway supports live logging by checking every minute if a report has been updated on FFLogs. If changes are detected, the summary is updated.

Reports are tracked automatically if they have been updated in the last 8 hours.

Limits :
- Only one report per server can be tracked
- Tracking stops if no updates have been detected for more than 1 hour and 30 minutes

