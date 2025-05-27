import { useEffect, useState } from "react";
// import "./App.css";
import LoadTestTable from "./components/Table";
import config from "./confg";
import { useAuth } from "react-oidc-context";
import { LaunchTest } from "./components/LaunchTest";
import { Button, Container } from "react-bootstrap";

function App() {
  const [sapSystems, setSAPSystems] = useState<string[]>([]);

  const auth = useAuth();
  useEffect(() => {
    const getSAPSystems = async () => {
      const fetchedSAPSystems = await fetchSAPSystems(auth.user?.access_token!);
      setSAPSystems(fetchedSAPSystems);
    };

    if (auth.isAuthenticated) {
      // getTests();
      getSAPSystems();
    }
  }, [auth.isAuthenticated, auth.user?.access_token]);

  const signOutRedirect = () => {
    const clientId = config.clientId;
    const logoutUri = config.cognitoLogoutUri;
    const cognitoDomain = config.cognitoDomain;
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
      logoutUri
    )}`;
  };

  const handleLogout = async () => {
    try {
      await auth.removeUser(); // Clear the local user state
      await auth.revokeTokens();
      signOutRedirect(); // Your existing signOutRedirect function
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (!auth.isAuthenticated) {
    auth.signinRedirect();
  }

  return (
    <>
      <div className="container">
        <div className="text-center">
          <h1 className="display-4">SAP Load Tests</h1>
        </div>
      </div>
      <Container>
        <LaunchTest
          accessToken={auth.user?.access_token!}
          sapSystems={sapSystems}
        />
        <LoadTestTable accessToken={auth.user?.access_token!} />
        <Button
          variant="outline-danger"
          onClick={handleLogout}
          className="mt-3"
        >
          Sign out
        </Button>{" "}
      </Container>
    </>
  );
}

async function fetchSAPSystems(accessToken: string): Promise<string[]> {
  const fetchSAPSystemsUrl = `${config.restApiBaseEndpoint}sap-systems`;
  try {
    const response = await fetch(fetchSAPSystemsUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${accessToken}`,
      },
    });
    const data = await response.json();
    const parsedSAPSystems: string[] = data;

    return parsedSAPSystems;
  } catch (error) {
    console.error("Error fetching sap systems:", error);
    return [];
  }
}

export default App;
