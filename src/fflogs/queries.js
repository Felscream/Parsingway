import { gql } from "graphql-request";

const reportQuery = gql`
  query getReportData($reportCode: String!) {
    reportData {
      report(code: $reportCode) {
        title
        startTime
        endTime
        owner {
          name
        }
        guild {
          name
        }
        fights {
          id
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
        rankings(playerMetric: playerspeed)
      }
    }
  }
`;

export { reportQuery };
