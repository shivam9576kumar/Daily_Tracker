import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * When true, a 401 response to this request will NOT trigger an
     * automatic hard redirect to /login. Used for background/silent
     * data refreshes (Todo, Dashboard, Plan) so an expired session
     * doesn't destroy in-progress UI state (e.g. an open composer)
     * during a passive background sync. The session is still cleared
     * via the 'auth:session-expired' event regardless.
     */
    silent?: boolean;
  }
}
