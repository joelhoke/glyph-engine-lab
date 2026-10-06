import { protectMutation, type ProtectionEnv } from '../lib/requestProtection'

export const onRequest: PagesFunction<ProtectionEnv> = context => protectMutation(context)
