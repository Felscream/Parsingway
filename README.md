# Parsingway - FFLogs report previewer for Discord

A small Discord bot that reads the most played encounters from an FFLogs report URL and displays a short summary in your discord channel.

<img src="https://i.imgur.com/PITHrG7.png">

The bot can only track one report per server.

Reports that have not been updated for more than 8 hours are not tracked.

Only the 7 most played encounters in a report are displayed.

Dungeons and small encounters are not displayed. 

Reports are updated every minute. If a report has not been updated with a new trackable encounter for more than 1 hour and 30 minutes, the tracking will stop.

Sending a new report on the Discord server, or a new message on the channel with the latest report will also stop further updates.
