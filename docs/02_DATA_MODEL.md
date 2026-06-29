Työmaat.fi – Data Model v1.0
Purpose

This document describes the core data model of Työmaat.fi.

The objective is to separate:

raw observations
interpreted knowledge
business intelligence
customer-specific recommendations

The system should evolve without requiring major database redesigns.

Data Flow
External Sources
        │
        ▼
Raw Documents
        │
        ▼
Project Signals
        │
        ▼
Entity Extraction
        │
        ▼
Candidate Projects
        │
        ▼
Knowledge Base
        │
        ▼
Intelligence Engine
        │
        ▼
Customer Matching
        │
        ▼
Projects
Project Signals

Represents one observation from one source.

Examples:

RSS article
Building permit
Procurement notice
Company press release
Municipality announcement

Characteristics

immutable
timestamped
traceable
never manually edited
Candidate Projects

Represents one real construction project.

A Candidate consists of one or more Signals.

Contains

title
location
project stage
confidence
business value
summary
timeline
quality explanation

Candidate is the central entity of the platform.

Candidate Entities

Candidate Entities describe structured information extracted from signals.

Examples

Companies

People

Roles

Money

Areas

Addresses

Dates

Building Types

Project Stages

Initially stored as JSON.

May later become normalized tables.

Organizations

Represents companies participating in projects.

Examples

Developer

Contractor

Designer

Consultant

Supplier

Future capabilities

organization history
relationship graph
preferred partners
historical projects
People

Represents named persons involved in projects.

Examples

Project Manager

Procurement Manager

Construction Manager

Developer Representative

Future capabilities

LinkedIn integration
contact enrichment
CRM synchronization
Knowledge Base

Static domain knowledge.

Contains

Building Types

Project Stages

Negative Projects

Source Rules

Customer Profiles

Company Roles

Construction terminology

Knowledge Base contains facts.

Not business decisions.

Intelligence Engine

Transforms knowledge into recommendations.

Modules

Keyword Scorer

Source Scorer

Metadata Scorer

Entity Scorer

Timeline Scorer

AI Scorer (optional)

Produces

Business Value

Discovery Confidence

Overall Priority

Recommended Action

Explanation

Customer Profiles

Represents different customer types.

Examples

Equipment Rental

Earthworks

Concrete

HVAC

Electrical

Architects

Structural Designers

Construction Companies

Material Suppliers

Consultants

Each profile contains

preferred stages

preferred contacts

preferred project types

minimum project size

future preferences

Customer Matching

Compares

Candidate

↓

Knowledge

↓

Customer Profile

Produces

Match Score

Recommended Contact

Recommended Timing

Reasoning

Projects

Projects visible to customers.

Created from Candidates.

Never directly from Signals.

Contains

customer-facing information

sales recommendations

contact suggestions

project history

Feedback

Future module.

Stores customer behaviour.

Examples

Project opened

Project saved

Contact requested

Opportunity won

Feedback continuously improves recommendations.

Long-term Vision

The database evolves into a Construction Knowledge Graph.

Signals

↓

Entities

↓

Projects

↓

Organizations

↓

People

↓

Relationships

↓

Customer Intelligence

↓

Business Intelligence

The value of the platform grows through accumulated knowledge, not only through software.