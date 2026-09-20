import { Code, CodeBlock, H3, P, Steps, Table } from './DocsUI';

/* API reference introduction: base URL, auth, limits, envelope, errors. */

const origin = typeof window !== 'undefined' ? window.location.origin : '';

export function ApiOverview() {
  return (
    <>
      <P>
        The REST API is served under <Code>/api/v1</Code>. Requests and responses are JSON; timestamps are ISO 8601.
        Every call is scoped to the caller&apos;s organization.
      </P>
      <CodeBlock language="text" code={`${origin}/api/v1`} />
      <H3>Authenticate</H3>
      <Steps
        items={[
          <>Sign in with <Code>POST /auth/login</Code> to receive an <Code>accessToken</Code> (15 minutes) and a <Code>refreshToken</Code> (7 days, also set as an httpOnly cookie).</>,
          <>Send <Code>Authorization: Bearer &lt;accessToken&gt;</Code> on every request.</>,
          <>When a request returns 401 <Code>Token expired</Code>, call <Code>POST /auth/refresh</Code> and retry.</>,
        ]}
      />
      <CodeBlock
        code={`curl -X POST ${origin}/api/v1/auth/login \\\n  -H "Content-Type: application/json" \\\n  -d '{"email": "you@company.com", "password": "…"}'\n\ncurl ${origin}/api/v1/incidents \\\n  -H "Authorization: Bearer <accessToken>"`}
      />
      <H3>Organization scope</H3>
      <P>
        Results are limited to your organization automatically. Only platform admins may target another organization,
        with <Code>X-Organization-Id: &lt;uuid&gt;</Code> or <Code>?orgId=</Code>; the header is ignored for other
        callers. An id belonging to another organization returns 404.
      </P>
    </>
  );
}

export function RateLimits() {
  return (
    <>
      <P>Limits are counted per client IP address.</P>
      <Table
        head={['Scope', 'Limit', 'Window']}
        rows={[
          ['All API requests', '100 requests', '1 minute'],
          [<>Sign-in and signup (<Code>/auth/login</Code>, <Code>/auth/signup</Code>)</>, '10 requests', '15 minutes'],
          [<>Alert webhook (<Code>POST /alerts/webhook</Code>)</>, '200 requests', '1 minute'],
        ]}
      />
      <P>Over the limit, the API answers <Code>429 Too Many Requests</Code>.</P>
    </>
  );
}

export function ResponseFormat() {
  return (
    <>
      <P>Responses use one envelope:</P>
      <CodeBlock language="json" code={`{\n  "success": true,\n  "data": { … }\n}`} />
      <H3>Lists</H3>
      <P>List endpoints accept <Code>?page=</Code> and <Code>?limit=</Code> and return pagination metadata alongside <Code>data</Code>.</P>
      <H3>Errors</H3>
      <CodeBlock language="json" code={`{\n  "success": false,\n  "error": "Incident not found"\n}`} />
    </>
  );
}

export function ErrorCodes() {
  return (
    <Table
      head={['Status', 'Meaning']}
      rows={[
        ['200 / 201', 'Success / created'],
        ['400', 'Invalid parameters or body'],
        ['401', 'Missing, invalid or expired token'],
        ['402', <><Code>SUBSCRIPTION_REQUIRED</Code> (trial or subscription lapsed — writes blocked) or <Code>SEAT_LIMIT_REACHED</Code></>],
        ['403', 'Your role may not do this'],
        ['404', 'Not found — including records of another organization'],
        ['409', 'Conflict, for example an email already registered or an active subscription'],
        ['423', 'Account locked after too many failed sign-ins (15 minutes)'],
        ['429', 'Rate limit exceeded'],
        ['500', 'Server error'],
      ]}
    />
  );
}
