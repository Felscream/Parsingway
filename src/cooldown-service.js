import { Duration, LocalDateTime } from 'js-joda'
import logger from '../logger.js'

var self
const HOUR_IN_MILLI = 3600000

export default class CooldownService {
  constructor (cooldown, callCountAlertThreshold) {
    this.cooldown = cooldown
    this.lastCallPerServer = new Map()
    this.callCountAlertThreshold = callCountAlertThreshold
    self = this

    // clear every hour
    setInterval(() => clear(), HOUR_IN_MILLI)
  }

  canGetReport (serverId) {
    if (!this.lastCallPerServer.has(serverId)) {
      return true
    }

    if (
      this.lastCallPerServer.get(serverId).callCount >=
      this.callCountAlertThreshold
    ) {
      logger.warn(
        `Server ${serverId} has had ${
          this.lastCallPerServer.get(serverId).callCount
        } calls in the last hour`
      )
      return false
    }

    return (
      Duration.between(
        this.lastCallPerServer.get(serverId).lastCall,
        LocalDateTime.now()
      ).seconds() >= this.cooldown
    )
  }

  registerServerCall (serverId) {
    if (this.lastCallPerServer.has(serverId)) {
      this.lastCallPerServer.get(serverId).newCall()
    } else {
      this.lastCallPerServer.set(serverId, new ServerCall())
    }
  }
}

function clear () {
  self.lastCallPerServer = new Map()
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
