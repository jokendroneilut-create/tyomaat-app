Työmaat.fi – System Architecture v1.0
Purpose

This document describes the technical architecture of Työmaat.fi.

It focuses on responsibilities of each subsystem, data flow and architectural principles.

The goal is to keep the architecture modular, scalable and easy to extend over several years of development.

High Level Architecture
External Sources
        │
        ▼
Discovery Engine
        │
        ▼
Raw Documents
        │
        ▼
Signal Parser
        │
        ▼
Project Signals
        │
        ▼
Classification
        │
        ▼
Candidate Linker
        │
        ▼
Candidate Enrichment
        │
        ▼
Candidate Quality Engine
        │
        ▼
Lifecycle Engine
        │
        ▼
Työmaat Intelligence Center
        │
        ▼
Promotion Engine
        │
        ▼
Projects
        │
        ▼
Customers
Discovery Engine

Responsible for collecting information.

Responsibilities:

RSS feeds
APIs
Municipal news
Procurement systems
Company websites
Future web crawlers

Discovery Engine should never decide whether something is a good project.

It only collects information.

Signal Parser

Transforms raw documents into structured signals.

Examples of extracted information:

title
city
source
url
publication date
project type
address
company names
building type
keywords

The parser should continuously become more structured.

Project Signals

Project Signals represent raw observations.

Characteristics:

immutable
never edited manually
traceable back to original source
deduplicated when possible

Signals are the historical truth.

Classification

Classification determines what kind of signal has been detected.

Examples:

building permit
zoning
procurement
contractor announcement
construction started
cancellation

Classification answers:

"What kind of signal is this?"

It does not determine business value.

Candidate Linker

Responsible for grouping multiple signals into one Candidate Project.

A Candidate may consist of:

zoning notice
building permit
procurement
company announcement
media article

The goal is:

One real project

instead of

Many independent signals.

Candidate Project

Candidate Project is the central object of the platform.

Everything revolves around Candidates.

Candidate contains:

title
location
companies
timeline
signals
quality
lifecycle
AI summary (future)

Customers do not see Candidates.

Candidates exist for internal intelligence.

Candidate Enrichment

Adds additional information.

Examples:

signal count
source count
confidence
companies
structured metadata
extracted entities

Enrichment should never make business decisions.

Candidate Quality Engine (CQE)

CQE evaluates business relevance.

CQE does NOT decide whether data is true.

CQE decides whether the Candidate is worth attention.

CQE consists of multiple scoring modules.

Examples:

keyword scorer
metadata scorer
source scorer
company scorer
AI scorer (future)

CQE produces:

Business Value
Overall Priority
Recommended Action
Explanation
Discovery Confidence

Discovery Confidence answers:

"How certain are we that our information is correct?"

Confidence depends on:

source reliability
multiple sources
structured data
consistency
duplicate observations

Confidence does NOT measure business value.

Business Value

Business Value answers:

"How valuable is this opportunity for customers?"

Examples:

High:

data centers
logistics
hospitals
schools
apartment buildings

Low:

terraces
garages
private saunas
small home extensions
Overall Priority

Overall Priority combines:

Discovery Confidence
Business Value
Project Stage
Customer Interest (future)

This determines sorting inside TIC.

Recommended Action

CQE should recommend one action.

Values:

ignore

review

promote

The final decision always belongs to a human.

Lifecycle Engine

Responsible for understanding project progress.

Examples:

Idea

↓

Planning

↓

Zoning

↓

Permit

↓

Tender

↓

Construction Started

↓

Completed

or

Cancelled

Lifecycle Engine updates project stage.

It does not calculate business value.

Työmaat Intelligence Center (TIC)

Internal operational workspace.

Primary question:

"What should I do today?"

Examples:

review Candidates
approve Projects
inspect failed sources
monitor trends
analyse customer interest

TIC is the operational control center.

Promotion Engine

Converts Candidate Projects into customer-facing Projects.

Promotion may be:

manual

or

semi-automatic

The Promotion Engine should preserve the full Candidate history.

Customer Projects

Projects visible to customers.

They represent high-quality construction opportunities.

Projects are created from Candidates.

Never directly from Signals.

Artificial Intelligence

AI is optional.

The platform must always function without AI.

AI should assist in:

summarization
difficult classification
duplicate detection
company extraction
quality estimation

AI should never become a mandatory dependency.

Core Architectural Principles
Collect broadly.
Structure early.
Merge intelligently.
Score transparently.
Explain every decision.
Human approves important decisions.
Preserve history.
Prefer deterministic rules before AI.
Keep modules independent.
Documentation evolves together with code.
Long-term Vision

Työmaat.fi evolves through three stages.

Stage 1

Construction Discovery Platform

↓

Stage 2

Construction Intelligence Platform

↓

Stage 3

Construction Operating System

The platform should eventually become the daily operating system for companies working in the Finnish construction market.