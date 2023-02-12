# Mermaid

This file tests whether the `.mermaid` extension works.

## ER Diagram

The following diagram is an example
[entity relationship diagram](https://mermaid.js.org/syntax/entityRelationshipDiagram.html)

```mermaid
---
title: Order example
---
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses
```
