import { Duration, LocalDateTime } from 'js-joda'
import logger from '../logger.js'

var self
const HOUR_IN_MILLI = 3600000

export default class CooldownService {
  constructor (cooldown, callCountAlertThreshold) {
    this.cooldown = cooldown
    this.lastCallPerServer = {}
    this.callCountAlertThreshold = callCountAlertThreshold
    self = this

    // clear every hour
    setInterval(() => clear(), HOUR_IN_MILLI)
  }

  canGetReport (serverId) {
    if (!this.lastCallPerServer.hasOwnProperty(serverId)) {
      return true
    }

    if (
      this.lastCallPerServer[serverId].callCount >= this.callCountAlertThreshold
    ) {
      logger.warn(
        `Server ${serverId} has had ${this.lastCallPerServer[serverId].callCount} calls in the last hour`
      )
      return false
    }

    if (
      Duration.between(
        this.lastCallPerServer[serverId].lastCall,
        LocalDateTime.now()
      ).seconds() >= this.cooldown
    ) {
      return true
    }
    return false
  }

  registerServerCall (serverId) {
    if (this.lastCallPerServer.hasOwnProperty(serverId)) {
      this.lastCallPerServer[serverId].newCall()
    } else {
      this.lastCallPerServer[serverId] = new ServerCall()
    }
  }
}

function clear () {
  self.lastCallPerServer = {}
}

class ServerCall {
  constructor () {
    this.lastCall = LocalDateTime.now()
    this.callCount = 1
  }

  newCall () {
    this.callCount += 1
    this.lastCall = LocalDateTime.now()
  }
}
