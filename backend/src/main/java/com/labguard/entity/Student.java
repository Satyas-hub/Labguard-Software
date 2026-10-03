package com.labguard.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "students")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Student {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "student_id", nullable = false, unique = true, length = 50)
    private String studentId;

    @Column(nullable = false, length = 100)
    private String department;

    @Column(nullable = false, length = 20)
    private String section;

    @Column(nullable = false)
    private Integer semester;

    @Column(name = "admission_year", nullable = false)
    private Integer admissionYear;

    @Column(length = 100)
    private String course;

    @Column(name = "roll_number", length = 50)
    private String rollNumber;

    @Column(name = "year_of_study")
    @Builder.Default
    private Integer yearOfStudy = 1;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
