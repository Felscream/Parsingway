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
      }
    }
  }
`;

const speedRankingQuery = gql`
  query getSpeedRanking($reportCode: String!, $fightIDs: [Int]) {
    reportData {
      report(code: $reportCode) {
        rankings(fightIDs: $fightIDs, playerMetric: playerspeed)
      }
    }
  }
`;

export { reportQuery, speedRankingQuery };
