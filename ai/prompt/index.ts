import system from './system'
import user from './user'
import code from './user/code'

export default {
  system: {
    default: system
  },
  user: {
    default: user,
    code: code
  }
}
