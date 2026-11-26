export const GET_PULL_REQUEST_CHECKS = /* GraphQL */ `
  query GetPullRequestChecks($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                state
                contexts(first: 100) {
                  nodes {
                    __typename
                    ... on CheckRun {
                      name
                      status
                      conclusion
                      detailsUrl
                      title
                      summary
                      checkSuite { app { slug name } }
                      annotations(first: 5) { nodes { message title annotationLevel } }
                    }
                    ... on StatusContext {
                      context
                      state
                      targetUrl
                      description
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const ADD_COMMENT = /* GraphQL */ `
  mutation AddComment($id: ID!, $body: String!) {
    addComment(input: { subjectId: $id, body: $body }) { clientMutationId }
  }
`;
