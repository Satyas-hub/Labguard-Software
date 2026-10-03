package com.labguard.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "hardware_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HardwareEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "lab_id", nullable = false)
    private Lab lab;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "computer_id", nullable = false)
    private Computer computer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "equipment_id")
    private Equipment equipment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    private Session session;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType; // HARDWARE_CONNECTED, HARDWARE_DISCONNECTED, HARDWARE_MISMATCH, CLIENT_OFFLINE, CLIENT_ONLINE

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String severity = "INFO"; // INFO, WARNING, CRITICAL

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description; // Neutral wording (e.g. "Mouse connection lost.")

    @Column(name = "event_time", nullable = false)
    private OffsetDateTime eventTime;

    @Column(columnDefinition = "TEXT")
    private String metadata;

    @PrePersist
    protected void onCreate() {
        if (eventTime == null) eventTime = OffsetDateTime.now();
    }
}
