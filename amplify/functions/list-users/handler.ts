import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersInGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({});

/** Known groups in the user pool — keeps this O(3) calls instead of O(N). */
const GROUPS = ['Admin', 'Editor', 'Member'];

export const handler = async () => {
  const userPoolId = process.env.AUTH_USERPOOL_ID!;

  // 1. Fetch all users with their attributes
  const users: {
    username: string;
    sub: string;
    email: string;
    givenName: string;
    familyName: string;
    status: string;
    enabled: boolean;
    groups: string[];
  }[] = [];

  let paginationToken: string | undefined;
  do {
    const response = await client.send(
      new ListUsersCommand({ UserPoolId: userPoolId, PaginationToken: paginationToken }),
    );

    for (const user of response.Users ?? []) {
      const attrs = Object.fromEntries(
        (user.Attributes ?? []).map((a) => [a.Name, a.Value]),
      );
      users.push({
        username: user.Username ?? '',
        sub: attrs['sub'] ?? '',
        email: attrs['email'] ?? '',
        givenName: attrs['given_name'] ?? '',
        familyName: attrs['family_name'] ?? '',
        status: user.UserStatus ?? '',
        enabled: user.Enabled ?? false,
        groups: [],
      });
    }

    paginationToken = response.PaginationToken;
  } while (paginationToken);

  // 2. For each known group, fetch its members and tag the users
  for (const group of GROUPS) {
    let token: string | undefined;
    do {
      const response = await client.send(
        new ListUsersInGroupCommand({ UserPoolId: userPoolId, GroupName: group, NextToken: token }),
      );
      for (const member of response.Users ?? []) {
        const u = users.find((u) => u.username === member.Username);
        if (u) u.groups.push(group);
      }
      token = response.NextToken;
    } while (token);
  }

  // 3. Sort by surname, then name
  users.sort((a, b) =>
    a.familyName.localeCompare(b.familyName) || a.givenName.localeCompare(b.givenName),
  );

  return users;
};
