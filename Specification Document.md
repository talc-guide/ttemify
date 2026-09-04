# Specification Document: TALC World Assistant

## 1\. Executive Summary

TALC World Assistant is an internal productivity tool designed to streamline text-processing tasks (such as professional rewriting, summarization, and grammar fixing) specifically for users active on the talcworld.com web platform.  
The application is architected as an isolated, lightweight standalone text-processing application that functions through a manual copy-paste workflow on either a MacBook (Safari/Chrome/Edge) or a Windows machine (Chrome/Edge). Users manually copy text from the talcworld.com web portal, paste it into the application input field, and trigger processing actions. All operational data routing remains exclusively scoped to the talcworld.com ecosystem.

## 1.2 Primary Use Case: WPM Reporting Summarization

The primary use case of the TALC World Assistant is to assist users in summarizing content from the Weekly Performance Management (WPM) reporting portal after merging 3 months of accumulated data. Each domain requires two distinct, labeled input text boxes to accept data before triggering the summarization process. The summarization process targets three specific domains as outlined below:

* **Mind:** Provides two distinct input text boxes labeled 'Involvement Notes' and 'Mentor Notes'. Summarizes these fields using the prompt template from the designated internal sheet. \[Reference URL: [https://reports.talcworld.com/wpm/reports/student/243/term/1?academicYearId=23\&tab=MIND](https://reports.talcworld.com/wpm/reports/student/243/term/1?academicYearId=23&tab=MIND)\]  
* **Skills:** Provides two distinct input text boxes labeled 'Involvement Notes' and 'Mentor Notes'. Summarizes these fields using the prompt template from the designated internal sheet. \[Reference URL: [https://reports.talcworld.com/wpm/reports/student/243/term/1?academicYearId=23\&tab=SKILL](https://reports.talcworld.com/wpm/reports/student/243/term/1?academicYearId=23&tab=SKILL)\]  
* **Demeanour:** Provides two distinct input text boxes labeled 'Observation Notes' and 'Management Notes'. Summarizes these fields using the prompt template from the designated internal sheet. \[Reference URL: [https://reports.talcworld.com/wpm/reports/student/243/term/1?academicYearId=23\&tab=DEMEANOUR](https://reports.talcworld.com/wpm/reports/student/243/term/1?academicYearId=23&tab=DEMEANOUR)\]

# 2\. Technical Architecture & Constraints

## 2.1 Target Platform Environment

* **Operating Systems:** macOS, Windows 11 / Windows 10\.  
* **Supported Browsers:** Safari (macOS native standalone app mode via "Add to Dock"), Google Chrome, Microsoft Edge.  
* **Target Scope:** Exclusively active on text fields and text selections within the talcworld.com domain.

## 2.2 System Diagram & Lifecycle Flow

\[User Copies Text from talcworld.com\]  
│  
▼  
\[User Switches to TALC Assistant App\]  
│  
▼  
\[User Pastes Text into Dual Input Fields (e.g., Source Notes & Mentor/Management Notes)\]  
│  
▼  
\[User Triggers 'Summarize' Action\]

# 5\. Prompt Engineering Templates

## 5.1 Mind Prompt

You will receive two separate inputs from the application's input fields: 'Involvement Notes' and 'Mentor Notes' regarding MIND-related activities from the last 3 months. Your task is to summarize them into 3-4 concise, impactful sentences.  
**Content Requirements:**

* Focus on key achievements or patterns (MAX 5 distinct activities).  
* Highlight changes or progression over the term.  
* Include one of these phrases: 'during the term' or 'over the last term'.  
* Include areas of focus for future growth.  
* Do NOT include development plans.  
* If negative remarks exist, integrate them neutrally in the middle of the response.

**Language & Structure:**

* Use pronouns (he/she) only—never the child's name.  
* Write in active voice (Subject \+ Verb \+ Object).  
* Keep sentences short, clear, and distinct.  
* Strictly Prohibited Words: Strong, Demonstrates, Additionally, But, However, Can’t, Don’t, Cannot, Although, Student, Teacher, Sometimes, Really.  
* Paragraph: A 30-word block must contain at least 2 sentences. No run-on sentences. No assumptions or interpretations.

## 5.2 Skill Prompt

You will receive two separate inputs from the application's input fields: 'Involvement Notes' and 'Mentor Notes' regarding skill-based activities from the last 3 months. Your task is to summarize them into 3-4 concise, impactful sentences.  
**Content Requirements:**

* Focus on key developments or patterns (MAX 5 distinct activities).  
* Highlight areas of focus for future growth.  
* Do NOT include development plans.  
* If negative remarks exist, integrate them neutrally in the middle of the response.

**Language & Structure:**

* Use pronouns (he/she) only—never the child's name.  
* Write in active voice (Subject \+ Verb \+ Object).  
* Keep sentences short, clear, and distinct.  
* Strictly Prohibited Words: Strong, Demonstrates, Additionally, But, However, Can’t, Don’t, Cannot, Although, Student, Teacher, Sometimes, Really.  
* Paragraph: A 30-word block must contain at least 2 sentences. No run-on sentences. No assumptions or interpretations.

## 5.3 Demeanour Prompt

You will receive two separate inputs from the application's input fields: 'Observation Notes' and 'Management Notes' regarding demeanour observed over the last 3 months. Your task is to summarize them into 3-4 sentences total, split into two specific paragraphs.

* **Paragraph 1 (Observation):** Summarize the behavioral patterns and key incidents.  
* **Paragraph 2 (Management):** Summarize the support, strategies, or interventions provided by mentors.

**Content Requirements:**

* Do NOT include development plans.  
* If negative remarks exist, integrate them neutrally in the middle of the response.

**Language & Structure:**

* Use pronouns (he/she) only—never the child's name.  
* Write in active voice (Subject \+ Verb \+ Object).  
* Keep sentences short, clear, and distinct.  
* Strictly Prohibited Words: Strong, Demonstrates, Additionally, But, However, Can’t, Don’t, Cannot, Although, Student, Teacher, Sometimes.

Paragraph: A 30-word block must contain at least 2 sentences. No run-on sentences. No assumptions or interpretations.