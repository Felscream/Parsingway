import { Duration, Instant, ZoneId, ZonedDateTime } from "js-joda";
import FflogsClient from "./fflogs/fflogs-client.js";
import { LocalTime } from "js-joda";
import { DateTimeFormatter } from "js-joda";

const DURATION_FORMATTER = DateTimeFormatter.ofPattern('m:ss');
class ReportService{
    constructor(fflogsConfiguration){
        this.fflogsClient = new FflogsClient(fflogsConfiguration)
    }

    async init(){
        await this.fflogsClient.init()
    }

    async synthesize(reportCode){
        const data = await this.fflogsClient.getReport(reportCode);
        this.buildReport(data)
        
    }

    buildReport(data){
        const rawReport = data.reportData.report;
        
        const startInstant = Instant.ofEpochMilli(rawReport.startTime);
        const startTime = ZonedDateTime.ofInstant(startInstant, ZoneId.systemDefault())
        const endInstant = Instant.ofEpochMilli(rawReport.endTime);
        const endTime = ZonedDateTime.ofInstant(endInstant, ZoneId.systemDefault())
        const report = new Report(rawReport.title, startTime, endTime, this.buildFights(rawReport))
        console.log(report)
    }

    buildFights(report){
        const phases = report.phases
        const pulls = report.fights.filter(fight => fight.difficulty === 100);
        const fights = {}
        pulls.forEach(element => {
            if(!fights.hasOwnProperty(element.name)){
                fights[element.name] = []
            }

            const duration = LocalTime.ofInstant(Instant.ofEpochMilli(element.endTime - element.startTime)).format(DURATION_FORMATTER)
            const pull = new Pull(element.bossPercentage, element.fightPercentage, element.kill, duration, element.lastPhase)
            fights[element.name].push(pull)
        });
        return fights;
    }
}

class Report{
    constructor(title, startTime, endTime, fights){
        this.title = title
        this.startTime = startTime
        this.endTime = endTime
        this.fights = fights
    }

}

class Pull{
    constructor(bossPercentage, fightPercentage, isKill, duration, lastPhase){
        this.bossPercentage = bossPercentage
        this.fightPercentage = fightPercentage
        this.kill = isKill
        this.duration = duration
        this.lastPhase = lastPhase
    }
}
export {ReportService, Report, Pull}