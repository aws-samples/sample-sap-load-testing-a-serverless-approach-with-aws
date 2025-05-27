import { useAuth } from "react-oidc-context";
import { useEffect } from "react";
import { Container, Spinner } from "react-bootstrap";

const Logout = () => {
  const auth = useAuth();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await auth.removeUser(); // Clear the local user state
        auth.signoutRedirect(); // Redirect to Cognito logout
      } catch (error) {
        console.error("Logout failed:", error);
      }
    };

    performLogout();
  }, [auth]);

  return (
    <Container className="text-center mt-5">
      <h2>Signing out...</h2>
      <Spinner animation="border" role="status">
        <span className="visually-hidden">Loading...</span>
      </Spinner>
    </Container>
  );
};

export default Logout;
