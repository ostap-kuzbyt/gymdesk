# Requirements

Gymdesk is a management system for a fitness club. Front-desk staff, coaches and administrators use it to run the club day to day.

## Scope

**Members**

- Full name, age, email (required, the primary contact) and phone (optional).
- A member holds subscriptions bought from a tariff. Each subscription has a start date and an expiry date.

**Check-ins**

- Every arrival of a member is recorded.
- A member can check in at most once per day on a given subscription.

**Coaches**

- A profile with specialization, weekly working hours and the list of assigned members.

**Workouts and reservations**

- Group classes and one-to-one sessions are scheduled in a studio with a coach.
- Members reserve a place. A group class has a capacity.

**Tariffs**

- Configurable plans such as single visit, monthly and yearly, each with a price and a duration.

**Reminders**

- Members are notified before their subscription expires.
- Staff can also send an expiry reminder or a promotion to a single member.

**Reports**

- Member list with visit activity.
- Revenue per month and per year.
- Coach and studio load per day.

## Roles

| Role      | Access                                                     |
| --------- | ---------------------------------------------------------- |
| admin     | everything, including tariffs, studios and coaches         |
| reception | members, subscriptions, check-ins, reservations, reminders |
| coach     | own schedule, read-only                                    |

## Out of scope

Online payments, member self-service portal, mobile apps.
