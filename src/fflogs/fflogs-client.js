import { GraphQLClient } from "graphql-request";
import { reportQuery, speedRankingQuery } from "./queries.js";

export default class FflogsClient {
  constructor(fflogsConfig) {
    this.conf = fflogsConfig;
  }

  async getToken() {
    const authHeader =
      "Basic " + btoa(this.conf.client_id + ":" + this.conf.client_secret);
    const response = await fetch(this.conf.token_url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const json = await response.json();
    if (response.status === 200) {
      this.nextTokenRefreshTime =
        Math.floor(Date.now() / 1000) + json.expires_in;
      return json.access_token;
    } else {
      throw new Error("Response was not OK: " + JSON.stringify(json ?? {}));
    }
  }

  async init() {
    const accessToken = await this.getToken();
    this.client = new GraphQLClient(this.conf.get("endpoint"), {
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    });
  }

  needToRefreshToken() {
    if (!this.client) {
      return true;
    }
    if (!this.nextTokenRefreshTime) {
      return true;
    }
    return this.nextTokenRefreshTime <= Math.floor(Date.now() / 1000);
  }

  async getReport(reportCode) {
    if (this.needToRefreshToken()) {
      await this.init();
    }
    const variables = { reportCode };
    return await this.client.request(reportQuery, variables);
  }

  async getSpeedRanking(reportCode, fightIDs) {
    if (this.needToRefreshToken()) {
      await this.init();
    }
    const variables = { reportCode, fightIDs };
    return await this.client.request(speedRankingQuery, variables);
  }
}
