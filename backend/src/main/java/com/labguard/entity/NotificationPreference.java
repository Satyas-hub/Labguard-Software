package com.labguard.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "notification_preferences")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationPreference {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "hardware_alerts", nullable = false)
    @Builder.Default
    private Boolean hardwareAlerts = true;

    @Column(name = "issue_alerts", nullable = false)
    @Builder.Default
    private Boolean issueAlerts = true;

    @Column(name = "maintenance_alerts", nullable = false)
    @Builder.Default
    private Boolean maintenanceAlerts = true;

    @Column(name = "session_alerts", nullable = false)
    @Builder.Default
    private Boolean sessionAlerts = true;

    @Column(name = "system_alerts", nullable = false)
    @Builder.Default
    private Boolean systemAlerts = true;

    @Column(name = "in_app_enabled", nullable = false)
    @Builder.Default
    private Boolean inAppEnabled = true;

    @Column(name = "browser_enabled", nullable = false)
    @Builder.Default
    private Boolean browserEnabled = false;

    @Column(name = "email_enabled", nullable = false)
    @Builder.Default
    private Boolean emailEnabled = false;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onSave() {
        updatedAt = OffsetDateTime.now();
    }
}
