import { Table, Container, Button, Spinner, Form } from "react-bootstrap";
import { formatDate } from "../utils/date-utils";
import { fetchTests, runExistingTest } from "../utils/load-test-utils";
import React, { useEffect, useState } from "react";
import LoadTest from "../types/LoadTest";

// import { DateTime } from "luxon";

// export interface TestProps {
//   status: string;
//   name: string;
//   startTime: Date;
//   endTime: Date;
//   duration: number;
//   dashboardLink: string;
// }

export interface LoadTestProps {
  accessToken: string;
}

// function LoadTestTable(accessToken: string, props: Props) {
export const LoadTestTable: React.FC<LoadTestProps> = ({ accessToken }) => {
  // const [isLoading, setIsLoading] = useState(false);
  const [loadingStates, setLoadingStates] = useState<{
    [key: string]: boolean;
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [pageSize, setPageSize] = useState<string>("20");
  const [tests, setTests] = useState<LoadTest[]>([]);

  // Function to fetch tests
  const loadTests = async () => {
    setIsLoading(true);
    try {
      // const size = pageSize === "ALL" ? "ALL" : pageSize;
      const fetchedTests = await fetchTests(accessToken, String(pageSize));
      setTests(fetchedTests || []);
    } catch (error) {
      console.error("Error fetching tests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Effect to load tests when component mounts or when pageSize changes
  useEffect(() => {
    loadTests();
  }, [pageSize, accessToken]);

  //handle test re-execution
  const handleRunAgain = async (
    previousExecutionId: string,
    accessToken: string
  ) => {
    setLoadingStates((prev) => ({ ...prev, [previousExecutionId]: true }));

    try {
      await runExistingTest(previousExecutionId, accessToken);

      // Show loading state for a moment to provide visual feedback
      setTimeout(() => {
        // Refresh the page after successful test launch
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error:", error);
      // Only reset loading state if there was an error
      setLoadingStates((prev) => ({ ...prev, [previousExecutionId]: false }));
    }
    // Note: We don't reset loading state in finally block anymore
    // since we're refreshing the page on success
  };

  return (
    <>
      {/* <div className="container">
        <div className="text-left">
          <h2>Test History (only last 20 executions)</h2>
        </div>
      </div> */}
      <div className="container">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2>Test History</h2>
          <Form.Group>
            <Form.Select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value)}
              aria-label="Select page size"
              disabled={isLoading}
            >
              <option value="10">10 per page</option>
              <option value="20">20 per page</option>
              <option value="100">100 per page</option>
              <option value="ALL">Show all</option>
            </Form.Select>
          </Form.Group>
        </div>
      </div>
      <Container>
        {tests.length === 0 && <p>No tests executed yet!</p>}
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Actions</th>
              <th>Status</th>
              <th>Execution ID</th>
              <th>SAP System</th>
              <th>Name</th>
              <th>Type</th>
              <th>Start</th>
              <th>End</th>
              {/* <th>Duration</th>
            <th>Dashboard Link</th> */}
            </tr>
          </thead>
          <tbody>
            {Array.isArray(tests) &&
              tests.map((test, index) => (
                <tr key={index}>
                  <td>
                    <Button
                      id={`runAgain${test.executionId}`}
                      onClick={() =>
                        handleRunAgain(test.executionId, accessToken)
                      }
                      // disabled={isLoading}
                      disabled={loadingStates[test.executionId]}
                    >
                      {loadingStates[test.executionId] ? (
                        <>
                          <Spinner
                            as="span"
                            animation="border"
                            size="sm"
                            role="status"
                            aria-hidden="true"
                            className="me-2"
                          />
                          Running...
                        </>
                      ) : (
                        "Run Again"
                      )}
                    </Button>

                    {/* <Button
                      id="runAgain"
                      variant="secondary"
                      className="btn-sm"
                      onClick={async () =>
                        await runExistingTest(test.executionId, accessToken)
                      }
                    >
                      Re-launch
                    </Button> */}
                  </td>
                  <td>{test.status}</td>
                  <td>{test.executionId}</td>
                  <td>{test.sapSID}</td>
                  <td>{test.testName}</td>
                  <td>{test.testType}</td>
                  <td>{formatDate(test.startDate?.toString())}</td>
                  <td>
                    {test.stopDate?.toString() != ""
                      ? formatDate(test.stopDate?.toString())
                      : ""}
                  </td>
                  {/* <td>{test.duration}</td>
                <td>{test.dashboardLink}</td> */}
                </tr>
              ))}
          </tbody>
        </Table>
      </Container>
    </>
  );
};

export default LoadTestTable;
