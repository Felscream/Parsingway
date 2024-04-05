import { gql } from "graphql-request";

const reportQuery = gql`
query getReportData($reportCode: String!){
    reportData{
		report(code: $reportCode){
			title
			startTime
			endTime
			phases{
				encounterID
				phases{
					id
					name
				}
			}
			fights{
				encounterID
				name
				bossPercentage
				fightPercentage
				kill
				difficulty
				startTime
				endTime
				lastPhase
			}
		}
	}
}
`

export {reportQuery}