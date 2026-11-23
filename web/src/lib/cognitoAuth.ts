/** 本物: Amplify Auth で Cognito にログインする。 */
import { Amplify } from 'aws-amplify';
import { confirmSignIn, fetchAuthSession, signIn, signOut } from 'aws-amplify/auth';
import { config } from '../config';
import type { Auth } from './auth';

export function createCognitoAuth(): Auth {
  Amplify.configure({
    Auth: { Cognito: { userPoolId: config.userPoolId, userPoolClientId: config.userPoolClientId } },
  });
  return {
    async signIn(email, password) {
      const { nextStep } = await signIn({ username: email, password });
      if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        return 'newPasswordRequired';
      }
      if (nextStep.signInStep !== 'DONE') throw new Error(`未対応のログイン手順: ${nextStep.signInStep}`);
      return 'done';
    },
    async setNewPassword(password) {
      await confirmSignIn({ challengeResponse: password });
    },
    async signOut() {
      await signOut();
    },
    async idToken() {
      try {
        const session = await fetchAuthSession();
        return session.tokens?.idToken?.toString() ?? null;
      } catch {
        return null;
      }
    },
  };
}
