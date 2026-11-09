import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUserGlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { sendEmail, loadEmailBody } from '../../utils/mailer';

const client = new CognitoIdentityProviderClient({});

async function sendConfirmation(name: string, surname: string, email: string) {

  const pkg = await import("../../package.json")
  try {
    
    const fullEmail = `${name} ${surname} <${email}>`

    await sendEmail(
        fullEmail,
        undefined,
        "Accesso approvato!",
        await loadEmailBody('confirm_registration', fullEmail, pkg.displayName, pkg.website, name)
    )

  } catch (error) {

    console.error("Errore nell'invio mail della lambda updateUserGroups:", error)

  }
}

export const handler = async (event: {
  arguments: { name: string, surname: string, email: string, username: string; group: string; action: 'add' | 'remove' };
}) => {

  const userPoolId = process.env.AUTH_USERPOOL_ID!;
  const { name, surname, email, username, group, action } = event.arguments;

  if (action === 'add') {

    await client.send(
      new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: username, GroupName: group }),
    )

    console.log("Richiesta di attivazione ruolo '" + group + "' per " + email + ' effettuata')
    if (group === 'Member') {
      await sendConfirmation(name, surname, email)
    }

  } else {

    await client.send(
      new AdminRemoveUserFromGroupCommand({
        UserPoolId: userPoolId,
        Username: username,
        GroupName: group,
      }),
    )

    // Invalidate all sessions so the user gets a fresh token without the removed group
    await client.send(
      new AdminUserGlobalSignOutCommand({ UserPoolId: userPoolId, Username: username }),
    )

    console.log("Richiesta di disattivazione ruolo '" + group + "' per " + email + ' effettuata')

  }

  return true
  
}
