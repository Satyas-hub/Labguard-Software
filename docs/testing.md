# LABGUARD Verification & Testing Guide

---

## 1. Automated Security & RBAC Tests

The backend test suite (`backend/src/test/java/com/labguard/LabSecurityEvaluatorTest.java`) executes critical security assertions:

1. **Faculty Access Isolation:**
   - Verifies Faculty assigned to `LAB-01` can access `LAB-01`.
   - **Crucial:** Verifies Faculty assigned to `LAB-01` receives `403 Forbidden` when attempting to access `LAB-05`.
2. **Lab Assistant Isolation:**
   - Verifies Lab Assistant can only query assigned laboratories.
3. **Student Privacy Isolation:**
   - Verifies a student cannot inspect another student's session details or private records.
4. **Admin Global Access:**
   - Verifies Administrator has unconditional access across all laboratories.

Run tests using Maven:
```bash
cd backend
mvn test
```

---

## 2. Interactive End-to-End Verification Scenarios

### Scenario A: Strict Faculty Lab Isolation
1. Open the web portal: `http://localhost:3000`.
2. Select the **FACULTY** role from the top navbar switcher (`faculty1@labguard.local`).
3. Notice that only **LAB-01** and **LAB-03** appear in the assigned laboratory buttons.
4. Click **"Test Unassigned LAB-05 🔒"**.
5. **Expected Result:** A prominent `403 FORBIDDEN: Institutional Lab Isolation Rule` alert is displayed, demonstrating that the user cannot bypass lab permissions.

### Scenario B: Lab Assistant "Who Is In" & "Who Left"
1. Switch role to **LAB_ASSISTANT** (`assistant1@labguard.local`).
2. Select **LAB-02**.
3. Under **"Who's In / Out"**:
   - Verify Active students: Carlos Gomez on `PC-003`, Prof. David Chen on `Faculty PC`.
   - Verify Completed exits: Alex Rivera on `PC-01` (IN 09:02 → OUT 10:00, 58 min), Brianne Zhao on `PC-02` (IN 09:03 → OUT 10:02, 59 min).

### Scenario C: Neutral Hardware Disconnect
1. On **LAB-03**, observe the hardware event log.
2. Notice the wording: **"Mouse connection lost."**
3. Verify that the event is logged objectively without accusing the student of damage.

### Scenario D: Student Session & Issue Reporting
1. Switch role to **STUDENT** (`student1@labguard.local`).
2. Inspect active practice session on `PC-001` in `LAB-02`.
3. Verify peripheral status: `Keyboard: VERIFIED`, `Mouse: VERIFIED`.
4. Navigate to **Report Issue**, select category, attach evidence, and submit ticket.
