# Parsingway - FFLogs report previewer for Discord

A small Discord bot that reads the most played encounters from an FFLogs report URL and displays a short summary in your discord channel.

<img src="https://i.imgur.com/PITHrG7.png">


The bot can only track one report per server.

Reports that have not been updated for more than 8 hours are not tracked.

Dungeons and small encounters are not displayed.

Reports are updated every minute. If a report has not been updated with a new trackable encounter for an hour and 30 minutes, the tracking will stop.

Sending a new report on the server, or a new message on the channel with the last tracked report will also stop further updates.
