import React, { ChangeEvent, useRef, useState } from "react";
import { Nav, Tab, Form, Button, Container } from "react-bootstrap";
import { createNewTest } from "../utils/load-test-utils";
import FieldInfoTooltip from "./FieldInfoTooltip";
import InfoLabel from "./InfoLabel";

interface Props {
  accessToken: string;
  sapSystems: string[];
}

interface FormData {
  //common
  testType: string;
  testName: string;
  sapSID: string;
  enableAnalytics: boolean | false;

  //application
  k6File: File | null;
  K6Options: string;

  //network
  delayms: string;
  duration: string;
}

export const LaunchTest: React.FC<Props> = ({ accessToken, sapSystems }) => {
  const [formData, setFormData] = useState<FormData>({
    testType: "application",
    testName: "",
    k6File: null,
    K6Options: "",
    sapSID: "",
    enableAnalytics: false,
    delayms: "",
    duration: "",
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [validated, setValidated] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [activeTab, setActiveTab] = useState<string>("application"); // or whatever your default tab key is
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add this handler for tab selection
  const handleTabSelect = (key: string | null) => {
    if (key) {
      setActiveTab(key);
      // Update the form data with the selected tab as the test type
      setFormData((prev) => ({
        ...prev,
        testType: key,
      }));
    }
  };

  const handleReset = () => {
    formRef.current?.reset();
    setValidated(false);
    setFormData({
      testType: "application",
      testName: "",
      // k6File: null,
      k6File: null,
      K6Options: "",
      sapSID: "",
      enableAnalytics: false,
      delayms: "",
      duration: "",
    });
  };

  const handleInputChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { id, value, type } = event.target;
    setFormData((prev) => ({
      ...prev,
      [id]:
        type === "checkbox"
          ? (event.target as HTMLInputElement).checked
          : value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    setIsSubmitting(true); // Start loading
    event.preventDefault();
    try {
      const executionId = Math.floor(Date.now() / 1000).toString();

      await createNewTest(executionId, accessToken, formData);

      setShowSuccess(true);

      // Show success message and then refresh the page after a short delay
      setTimeout(() => {
        setShowSuccess(false);
        // Refresh the page after showing success message
        window.location.reload();
      }, 2000);

      handleReset();
    } catch (err) {
      console.log("Error:", err);
    } finally {
      setIsSubmitting(false); // Stop loading regardless of success/failure
    }
  };

  return (
    <>
      <div className="container">
        <div className="text-left">
          <h2>Launch new test</h2>
        </div>
      </div>
      <Container>
        {showSuccess && (
          <div className="alert alert-success" role="alert">
            Test launched successfully!
          </div>
        )}

        <div className="container mt-4"></div>

        <div className="container mt-4">
          <Tab.Container
            activeKey={activeTab}
            defaultActiveKey="application"
            onSelect={handleTabSelect}
          >
            <Nav variant="tabs" className="mb-3">
              <Nav.Item>
                <Nav.Link eventKey="application">Application</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="database">Database</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="network">Network</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="infrastructure">Infrastructure</Nav.Link>
              </Nav.Item>
            </Nav>

            <Tab.Content>
              <Tab.Pane eventKey="application">
                <Form
                  onSubmit={handleSubmit}
                  encType="application/json"
                  ref={formRef}
                  noValidate
                  validated={validated}
                >
                  <div className="p-3">
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <InfoLabel
                          label="Test Name"
                          required={true}
                          description="A unique name to identify this test run"
                        />
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="testName"
                        id="testName"
                        value={formData.testName}
                        onChange={handleInputChange}
                        required
                        aria-label="Test Name"
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        <InfoLabel
                          label="SAP System"
                          required={true}
                          description="The SAP System ID to run the test against"
                        />
                      </Form.Label>
                      <Form.Select
                        name="sapSID"
                        id="sapSID"
                        value={formData.sapSID}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                          setFormData((prev) => {
                            const newData = {
                              ...prev,
                              sapSID: e.target.value,
                            };
                            return newData;
                          });
                        }}
                        required
                        aria-label="SAP System Selection"
                      >
                        <option value="">Select SAP System</option>
                        {sapSystems.map((system) => (
                          <option key={system} value={system}>
                            {system}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Check
                        type="switch"
                        id="enableAnalytics"
                        name="enableAnalytics"
                        label={
                          <>
                            Enable Analytics
                            <FieldInfoTooltip description="Enable detailed analytics and metrics collection during the test" />
                          </>
                        }
                        checked={formData.enableAnalytics}
                        onChange={handleInputChange}
                        aria-label="Enable Analytics Switch"
                      />
                    </Form.Group>

                    <Form.Control
                      type="hidden"
                      name="testType"
                      value={formData.testType}
                    />
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <InfoLabel
                          label="K6 File"
                          required={true}
                          description="Upload a K6 script with a zip archive containing all required files"
                        />
                      </Form.Label>
                      <Form.Control
                        type="file"
                        name="k6File"
                        id="k6File"
                        accept=".js,.k6,.zip"
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          if (e.target.files && e.target.files[0]) {
                            // Log to verify file is being captured
                            setFormData((prev) => ({
                              ...prev,
                              k6File: e.target.files![0],
                            }));
                          }
                        }}
                        required
                      />
                      <Form.Control.Feedback type="invalid">
                        Please select a K6 file.
                      </Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        <InfoLabel
                          label="K6 Options"
                          description="Additional options to pass to the K6 test runner"
                        />
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        id="K6Options"
                        name="K6Options"
                        value={formData.K6Options}
                        onChange={handleInputChange}
                      />
                    </Form.Group>

                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isSubmitting}
                    >
                      Launch Test
                    </Button>
                  </div>
                </Form>
              </Tab.Pane>

              <Tab.Pane eventKey="database">
                <Form
                  onSubmit={handleSubmit}
                  encType="application/json"
                  ref={formRef}
                  noValidate
                  validated={validated}
                >
                  <div className="p-3">
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <InfoLabel
                          label="Test Name"
                          required={true}
                          description="A unique name to identify this test run"
                        />
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="testName"
                        id="testName"
                        value={formData.testName}
                        onChange={handleInputChange}
                        required
                        aria-label="Test Name"
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        <InfoLabel
                          label="SAP System"
                          required={true}
                          description="The SAP System ID to run the test against"
                        />
                      </Form.Label>
                      <Form.Select
                        name="sapSID"
                        id="sapSID"
                        value={formData.sapSID}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                          setFormData((prev) => {
                            const newData = {
                              ...prev,
                              sapSID: e.target.value,
                            };
                            return newData;
                          });
                        }}
                        required
                        aria-label="SAP System Selection"
                      >
                        <option value="">Select SAP System</option>
                        {sapSystems.map((system) => (
                          <option key={system} value={system}>
                            {system}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Check
                        type="switch"
                        id="enableAnalytics"
                        name="enableAnalytics"
                        label={
                          <>
                            Enable Analytics
                            <FieldInfoTooltip description="Enable detailed analytics and metrics collection during the test" />
                          </>
                        }
                        checked={formData.enableAnalytics}
                        onChange={handleInputChange}
                        aria-label="Enable Analytics Switch"
                      />
                    </Form.Group>

                    <Form.Control
                      type="hidden"
                      name="testType"
                      value={formData.testType}
                    />
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <InfoLabel
                          label="K6 File"
                          required={true}
                          description="Upload a K6 script with a zip archive containing all required files"
                        />
                      </Form.Label>
                      <Form.Control
                        type="file"
                        name="k6File"
                        id="k6File"
                        accept=".js,.k6,.zip"
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          if (e.target.files && e.target.files[0]) {
                            // Log to verify file is being captured
                            setFormData((prev) => ({
                              ...prev,
                              k6File: e.target.files![0],
                            }));
                          }
                        }}
                        required
                      />
                      <Form.Control.Feedback type="invalid">
                        Please select a K6 file.
                      </Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        <InfoLabel
                          label="K6 Options"
                          description="Additional options to pass to the K6 test runner"
                        />
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        id="K6Options"
                        name="K6Options"
                        value={formData.K6Options}
                        onChange={handleInputChange}
                      />
                    </Form.Group>

                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isSubmitting}
                    >
                      Launch Test
                    </Button>
                  </div>
                </Form>
              </Tab.Pane>

              <Tab.Pane eventKey="network">
                <Form
                  onSubmit={handleSubmit}
                  encType="application/json"
                  ref={formRef}
                  noValidate
                  validated={validated}
                >
                  <div className="p-3">
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <InfoLabel
                          label="Test Name"
                          required={true}
                          description="A unique name to identify this test run"
                        />
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="testName"
                        id="testName"
                        value={formData.testName}
                        onChange={handleInputChange}
                        required
                        aria-label="Test Name"
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        <InfoLabel
                          label="SAP System"
                          required={true}
                          description="The SAP System ID to run the test against"
                        />
                      </Form.Label>
                      <Form.Select
                        name="sapSID"
                        id="sapSID"
                        value={formData.sapSID}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                          setFormData((prev) => {
                            const newData = {
                              ...prev,
                              sapSID: e.target.value,
                            };
                            return newData;
                          });
                        }}
                        required
                        aria-label="SAP System Selection"
                      >
                        <option value="">Select SAP System</option>
                        {sapSystems.map((system) => (
                          <option key={system} value={system}>
                            {system}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Check
                        type="switch"
                        id="enableAnalytics"
                        name="enableAnalytics"
                        label={
                          <>
                            Enable Analytics
                            <FieldInfoTooltip description="Enable detailed analytics and metrics collection during the test" />
                          </>
                        }
                        checked={formData.enableAnalytics}
                        onChange={handleInputChange}
                        aria-label="Enable Analytics Switch"
                      />
                    </Form.Group>

                    <Form.Control
                      type="hidden"
                      name="testType"
                      value={formData.testType}
                    />
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <InfoLabel
                          label="Delay (ms)"
                          required={true}
                          description="Delay between requests in milliseconds"
                        />
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="delayms"
                        id="delayms"
                        value={formData.delayms}
                        onChange={handleInputChange}
                        required
                        aria-label="Delay(ms)"
                      />
                      <Form.Control.Feedback type="invalid">
                        Please specify the delay in milliseconds
                      </Form.Control.Feedback>
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <InfoLabel
                          label="Duration (seconds)"
                          required={true}
                          description="Total duration of the test in seconds"
                        />
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="duration"
                        id="duration"
                        value={formData.duration}
                        onChange={handleInputChange}
                        required
                        aria-label="Duration"
                      />
                      <Form.Control.Feedback type="invalid">
                        Please specify the duration in seconds
                      </Form.Control.Feedback>
                    </Form.Group>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isSubmitting}
                    >
                      Launch Test
                    </Button>
                  </div>
                </Form>
              </Tab.Pane>

              <Tab.Pane eventKey="infrastructure">
                <Form
                  onSubmit={handleSubmit}
                  encType="application/json"
                  ref={formRef}
                  noValidate
                  validated={validated}
                >
                  <div className="p-3">
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <InfoLabel
                          label="Test Name"
                          required={true}
                          description="A unique name to identify this test run"
                        />
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="testName"
                        id="testName"
                        value={formData.testName}
                        onChange={handleInputChange}
                        required
                        aria-label="Test Name"
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>
                        <InfoLabel
                          label="SAP System"
                          required={true}
                          description="The SAP System ID to run the test against"
                        />
                      </Form.Label>
                      <Form.Select
                        name="sapSID"
                        id="sapSID"
                        value={formData.sapSID}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                          setFormData((prev) => {
                            const newData = {
                              ...prev,
                              sapSID: e.target.value,
                            };
                            return newData;
                          });
                        }}
                        required
                        aria-label="SAP System Selection"
                      >
                        <option value="">Select SAP System</option>
                        {sapSystems.map((system) => (
                          <option key={system} value={system}>
                            {system}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Check
                        type="switch"
                        id="enableAnalytics"
                        name="enableAnalytics"
                        label={
                          <>
                            Enable Analytics
                            <FieldInfoTooltip description="Enable detailed analytics and metrics collection during the test" />
                          </>
                        }
                        checked={formData.enableAnalytics}
                        onChange={handleInputChange}
                        aria-label="Enable Analytics Switch"
                      />
                    </Form.Group>

                    <Form.Control
                      type="hidden"
                      name="testType"
                      value={formData.testType}
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isSubmitting}
                    >
                      Launch Test
                    </Button>
                  </div>
                </Form>
              </Tab.Pane>
            </Tab.Content>
          </Tab.Container>
        </div>
      </Container>
    </>
  );
};
