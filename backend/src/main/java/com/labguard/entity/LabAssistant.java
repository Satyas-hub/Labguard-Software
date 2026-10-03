package com.labguard.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "lab_assistants")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LabAssistant {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "employee_id", nullable = false, unique = true, length = 50)
    private String employeeId;

    @Column(name = "assistant_id", length = 50)
    private String assistantId;

    @Column(nullable = false, length = 100)
    private String department;

    @Column(length = 50)
    @Builder.Default
    private String shift = "GENERAL";

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
